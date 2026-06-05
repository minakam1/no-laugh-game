// ============================================================
// SCF 云函数入口（README 5.2 节）
// 双重 AI 调用 + SSE 伪流式 + 沉默检测
// ============================================================

const { audience, judge } = require('./prompts.js');

const DIFFICULTY_MAX_TOKENS = {
  1: 2048,
  2: 2048,
  3: 2048,
  4: 2048,
  5: 2048,
};

const SILENCE_KEYWORDS = ['过', '嗯', '知道了', '下一个', '……'];

/**
 * 调用 AI API（OpenAI 兼容）
 */
async function callLLM(apiKey, params) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: params.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      max_tokens: params.max_tokens || 60,
      temperature: 0.8,
      stream: false,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`AI API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

exports.main = async (event) => {
  // SCF API 网关触发器：event.body 是 JSON 字符串
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event;
  const { sceneDesc, level, apiKey } = body;

  if (!sceneDesc || !apiKey) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '缺少 sceneDesc 或 apiKey' }),
    };
  }

  const difficulty = Math.min(5, Math.max(1, Number(level) || 1));
  const systemPrompt = audience[`lv${difficulty}`];

  try {
    // === 第一次调用：AI 观众反应 ===
    const audienceResult = await callLLM(apiKey, {
      model: 'gpt-4o-mini',
      system: systemPrompt,
      user: `你正在观看一场直播，主播刚才表演了：${sceneDesc}\n\n请作为直播间观众，用弹幕风格实时反应。`,
      max_tokens: DIFFICULTY_MAX_TOKENS[difficulty] || 60,
    });

    const fullReaction = (audienceResult || '').trim();

    // === 判断沉默回合 ===
    const isSilence =
      !fullReaction ||
      SILENCE_KEYWORDS.includes(fullReaction) ||
      fullReaction.length <= 2;

    // === 第二次调用：AI 裁判评分 ===
    const judgeResult = await callLLM(apiKey, {
      model: 'gpt-4o-mini',
      system: judge,
      user: `观众难度：${difficulty}\n观众回复：${fullReaction || '(观众沉默，未发弹幕)'}`,
      max_tokens: 2048,
    });

    let funnyScore, reason;
    try {
      const jsonMatch = judgeResult.match(/\{[\s\S]*"funny_score"[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : judgeResult);
      funnyScore = parsed.funny_score;
      reason = parsed.reason;
    } catch (_e) {
      funnyScore = 5;
      reason = '裁判打了个盹';
    }

    // 构造 SSE 格式响应
    const sseBody = [
      `data: ${fullReaction}`,
      'data: [REACTION_DONE]',
      `data: ${JSON.stringify({ reaction: fullReaction, funnyScore, reason, isSilence })}`,
    ].join('\n\n');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
      body: sseBody,
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
