// ============================================================
// SCF 云函数入口
// Motion Observation Packet + SSE 协议 + 上游流式优先
// ============================================================

const { audience, judge } = require('./prompts.js');

const DIFFICULTY_MAX_TOKENS = {
  1: 160,
  2: 140,
  3: 100,
  4: 120,
  5: 40,
};

const SILENCE_KEYWORDS = ['过', '嗯', '嗯。', '知道了', '知道了。', '下一个', '下一个。', '……'];

function normalizeBaseUrl(baseUrl) {
  const raw = (baseUrl || process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  return raw.endsWith('/chat/completions') ? raw : `${raw}/chat/completions`;
}

function sse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function buildObservationText(observation) {
  return `你正在观看一段道具表演。系统只提供观察事实，不提供剧情解释。

【Observation Packet】
${JSON.stringify(observation, null, 2)}

【要求】
- 不要复述 JSON，不要解释你如何判断。
- 根据物体运动、空间关系、可能连锁、前后截图差异，自行判断这段表演是否好笑。
- 只输出真实直播观众会发的一条弹幕。`;
}

function buildUserContent(observation, beforeScreenshot, afterScreenshot, includeImages) {
  const text = buildObservationText(observation);
  if (!includeImages) return text;

  const content = [{ type: 'text', text }];
  if (beforeScreenshot && beforeScreenshot.startsWith('data:image/')) {
    content.push({ type: 'image_url', image_url: { url: beforeScreenshot } });
  }
  if (afterScreenshot && afterScreenshot.startsWith('data:image/')) {
    content.push({ type: 'image_url', image_url: { url: afterScreenshot } });
  }
  return content.length > 1 ? content : text;
}

async function readOpenAIStream(response, onDelta) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const dataLines = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart());
      const data = dataLines.join('\n');
      if (!data || data === '[DONE]') continue;

      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta?.content
        || parsed.choices?.[0]?.message?.content
        || '';
      if (!delta) continue;

      fullText += delta;
      onDelta(delta);
    }
  }

  return fullText;
}

async function callLLM(params) {
  const url = normalizeBaseUrl(params.baseUrl);
  const apiKey = params.apiKey || process.env.AI_API_KEY || '';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: params.model || process.env.AI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      max_tokens: params.maxTokens || 120,
      temperature: 0.8,
      stream: false,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`AI API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callLLMStream(params) {
  const url = normalizeBaseUrl(params.baseUrl);
  const apiKey = params.apiKey || process.env.AI_API_KEY || '';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: params.model || process.env.AI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      max_tokens: params.maxTokens || 120,
      temperature: 0.8,
      stream: true,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok || !response.body) {
    throw new Error(`AI stream unsupported: ${response.status}`);
  }

  return readOpenAIStream(response, params.onDelta);
}

async function getAudienceReaction(params, events) {
  const hasImages = Boolean(params.beforeScreenshot || params.afterScreenshot);
  const includeImages = hasImages && params.supportsImages === true;
  const userWithImages = buildUserContent(
    params.observation,
    params.beforeScreenshot,
    params.afterScreenshot,
    includeImages,
  );

  try {
    return await callLLMStream({
      ...params,
      user: userWithImages,
      onDelta: (text) => events.push(sse('reaction_delta', { text })),
    });
  } catch (streamError) {
    console.warn('Audience stream failed, falling back:', streamError.message);
  }

  try {
    const fullText = await callLLM({
      ...params,
      user: userWithImages,
    });
    for (const char of fullText) {
      events.push(sse('reaction_delta', { text: char }));
    }
    return fullText;
  } catch (imageError) {
    if (!includeImages) throw imageError;
    console.warn('Audience vision failed, falling back to text only:', imageError.message);
  }

  const fullText = await callLLM({
    ...params,
    user: buildUserContent(params.observation, '', '', false),
  });
  for (const char of fullText) {
    events.push(sse('reaction_delta', { text: char }));
  }
  return fullText;
}

exports.main = async (event) => {
  const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event;
  const {
    observation,
    level,
    apiKey,
    baseUrl,
    model,
    supportsImages,
    beforeScreenshot,
    afterScreenshot,
  } = body;

  if (!observation) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: '缺少 observation' }),
    };
  }

  const difficulty = Math.min(5, Math.max(1, Number(level) || 1));
  const events = [];

  try {
    const audienceResult = await getAudienceReaction({
      apiKey,
      baseUrl,
      model,
      supportsImages,
      observation,
      beforeScreenshot,
      afterScreenshot,
      system: audience[`lv${difficulty}`],
      maxTokens: DIFFICULTY_MAX_TOKENS[difficulty] || 120,
    }, events);

    const fullReaction = (audienceResult || '').trim();
    const isSilence =
      !fullReaction ||
      SILENCE_KEYWORDS.includes(fullReaction) ||
      fullReaction.length <= 2;

    events.push(sse('reaction_done', { reaction: fullReaction, isSilence }));

    const judgeResult = await callLLM({
      apiKey,
      baseUrl,
      model,
      system: judge,
      user: `观众难度：${difficulty}\n观众回复：${fullReaction || '(观众沉默，未发弹幕)'}`,
      maxTokens: 80,
    });

    let funnyScore;
    let reason;
    try {
      const jsonMatch = judgeResult.match(/\{[\s\S]*"funny_score"[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : judgeResult);
      funnyScore = Number(parsed.funny_score);
      reason = parsed.reason;
    } catch (_e) {
      funnyScore = 5;
      reason = '裁判打了个盹';
    }

    events.push(sse('score', {
      reaction: fullReaction,
      funnyScore,
      reason,
      isSilence,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
      body: events.join(''),
    };
  } catch (err) {
    console.error('SCF Error:', err.message);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || 'AI 服务异常' }),
    };
  }
};
