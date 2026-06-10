// ============================================================
// usePerform — 运动关系观察包 + 流式优先 + 逐字降级
// ============================================================

import { useState, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { PerformRequestedData } from '@/phaser/bridges/PhaserEventBus';
import type { ApiConfig } from '@/components/ApiKeyInput';
import type { PerformResponse } from '@/types';

const SILENCE_MESSAGES: Record<number, string> = {
  1: '阿乐笑得说不出话了…',
  2: '小七："这集我看过了吧？"',
  3: '老陈潜水了，没有弹幕…',
  4: '林老师沉默地摇了摇头',
  5: '零号评审在笔记上写了些什么',
};

const TYPEWRITER_DELAY_MS = 24;

interface UsePerformReturn {
  reaction: string;
  isLoading: boolean;
  error: string | null;
  handlePerform: (data: PerformRequestedData) => Promise<void>;
  dismissError: () => void;
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

type DeltaHandler = (text: string) => void;

function isLocalBaseUrl(baseUrl: string): boolean {
  return baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost');
}

function getChatUrl(baseUrl: string): string {
  return isLocalBaseUrl(baseUrl)
    ? '/api/chat/completions'
    : `${baseUrl.replace(/\/$/, '')}/chat/completions`;
}

function getPerformUrl(): string {
  return import.meta.env.VITE_CLOUD_FUNCTION_URL || '/api/perform';
}

function normalizeSilence(reaction: string, level: number): { text: string; isSilence: boolean } {
  const fullReaction = reaction.trim();
  const isSilence =
    !fullReaction ||
    ['过', '嗯', '知道了', '下一个', '……', '嗯。', '知道了。', '下一个。'].includes(fullReaction) ||
    fullReaction.length <= 2;

  return {
    text: isSilence ? (SILENCE_MESSAGES[level] || '观众沉默了…') : fullReaction,
    isSilence,
  };
}

async function typewriter(text: string, onDelta: DeltaHandler): Promise<void> {
  for (const char of text) {
    onDelta(char);
    await new Promise((resolve) => window.setTimeout(resolve, TYPEWRITER_DELAY_MS));
  }
}

function appendEventData(buffer: string, chunk: string): { events: Array<{ event: string; data: string }>; buffer: string } {
  let nextBuffer = buffer + chunk.replace(/\r\n/g, '\n');
  const events: Array<{ event: string; data: string }> = [];
  let boundary = nextBuffer.indexOf('\n\n');

  while (boundary !== -1) {
    const raw = nextBuffer.slice(0, boundary).trim();
    nextBuffer = nextBuffer.slice(boundary + 2);

    if (raw) {
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      }
      events.push({ event, data: dataLines.join('\n') });
    }

    boundary = nextBuffer.indexOf('\n\n');
  }

  return { events, buffer: nextBuffer };
}

function parseOpenAIStreamDelta(data: string): string {
  if (!data || data === '[DONE]') return '';
  const parsed = JSON.parse(data);
  return parsed.choices?.[0]?.delta?.content
    ?? parsed.choices?.[0]?.message?.content
    ?? '';
}

function createAudiencePrompt(level: number): string {
  const prompts: Record<number, string> = {
    1: `你是"阿乐"，直播间观众，笑点极低。你看到的是系统记录的道具运动事实和前后截图，不要复述数据，自己判断有没有好笑、意外、连锁或反差。必带"哈哈哈哈"，高频词：笑死、绷不住、救命。1-2句话弹幕，不超过50字。不需要分析，直接说弹幕。`,
    2: `你是"小七"，冲浪达人，见过世面。你看到的是道具运动事实和前后截图，不要复述数据，自己判断运动关系里有没有新活。觉得好说"有点东西"，一般说"还行"，差说"看过"。1-2句话弹幕，不需要分析，直接说弹幕。`,
    3: `你是"老陈"，潜水老观众。你看到的是道具运动事实和前后截图，不要复述数据，只在真正有料时才开口。日常回"……"或"还行"，真被逗到回"草""绝了"。1-2句话弹幕，不超过50字。`,
    4: `你是"林老师"，戏剧评论人，极度挑剔。你看到的是道具运动事实和前后截图，不要复述数据，自己判断其中是否有结构错位、荒诞或克制的意外。无感回"过"，可取处说"有趣的结构"，真正被逗到说"精妙"。1-2句话弹幕。`,
    5: `你是"零号评审"，职业幽默鉴赏官，默认无情绪波动。你看到的是道具运动事实和前后截图，不要复述数据，只判断是否值得反应。99%回"嗯""知道了""下一个"，极罕见破防回"有点意思""不坏"。1句话不超过10字。`,
  };
  return prompts[level] || prompts[1];
}

function createObservationText(data: PerformRequestedData): string {
  return `你正在观看一段道具表演。系统只提供观察事实，不提供剧情解释。

【Observation Packet】
${JSON.stringify(data.observation, null, 2)}

【要求】
- 不要复述 JSON，不要解释你如何判断。
- 根据物体运动、空间关系、可能连锁、前后截图差异，自行判断这段表演是否好笑。
- 只输出真实直播观众会发的一条弹幕。`;
}

function createUserContent(data: PerformRequestedData, includeImages: boolean) {
  const text = createObservationText(data);
  if (!includeImages) return text;

  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text },
  ];

  if (data.beforeScreenshot?.startsWith('data:image/')) {
    content.push({ type: 'image_url', image_url: { url: data.beforeScreenshot } });
  }
  if (data.afterScreenshot?.startsWith('data:image/')) {
    content.push({ type: 'image_url', image_url: { url: data.afterScreenshot } });
  }

  return content.length > 1 ? content : text;
}

async function callChatOnce(params: {
  apiConfig: ApiConfig;
  messages: ChatMessage[];
  maxTokens: number;
  signal: AbortSignal;
}): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (params.apiConfig.apiKey) headers.Authorization = `Bearer ${params.apiConfig.apiKey}`;

  const response = await fetch(getChatUrl(params.apiConfig.baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: params.apiConfig.model,
      messages: params.messages,
      max_tokens: params.maxTokens,
      temperature: 0.8,
      stream: false,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const errMap: Record<number, string> = {
      401: 'API Key 无效，请检查后重试',
      429: '请求太频繁，请稍后再试',
      500: 'AI 服务异常，请稍后重试',
      504: 'AI 响应超时，请简化场景或重试',
    };
    throw new Error(errMap[response.status] || `AI API 错误 (${response.status})`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callChatStream(params: {
  apiConfig: ApiConfig;
  messages: ChatMessage[];
  maxTokens: number;
  signal: AbortSignal;
  onDelta: DeltaHandler;
}): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (params.apiConfig.apiKey) headers.Authorization = `Bearer ${params.apiConfig.apiKey}`;

  const response = await fetch(getChatUrl(params.apiConfig.baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: params.apiConfig.model,
      messages: params.messages,
      max_tokens: params.maxTokens,
      temperature: 0.8,
      stream: true,
    }),
    signal: params.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`stream unsupported (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  let isReading = true;
  while (isReading) {
    const { done, value } = await reader.read();
    if (done) {
      isReading = false;
      break;
    }

    const parsed = appendEventData(buffer, decoder.decode(value, { stream: true }));
    buffer = parsed.buffer;

    for (const event of parsed.events) {
      const delta = parseOpenAIStreamDelta(event.data);
      if (!delta) continue;
      fullText += delta;
      params.onDelta(delta);
    }
  }

  if (!fullText) throw new Error('stream returned empty content');
  return fullText;
}

async function callPerformProxy(params: {
  apiConfig: ApiConfig;
  level: number;
  data: PerformRequestedData;
  signal: AbortSignal;
  onDelta: DeltaHandler;
}): Promise<PerformResponse> {
  const response = await fetch(getPerformUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      observation: params.data.observation,
      level: params.level,
      apiKey: params.apiConfig.apiKey || undefined,
      baseUrl: params.apiConfig.baseUrl,
      model: params.apiConfig.model,
      supportsImages: params.apiConfig.supportsImages,
      beforeScreenshot: params.data.beforeScreenshot,
      afterScreenshot: params.data.afterScreenshot,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    throw new Error(`代理请求失败 (${response.status})`);
  }

  if (!response.body) {
    const json = await response.json();
    return {
      reaction: json.reaction || '',
      funnyScore: Number(json.funnyScore ?? json.funny_score ?? 0),
      reason: json.reason || '',
      isSilence: json.isSilence,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reaction = '';
  let score: PerformResponse | null = null;

  let isReading = true;
  while (isReading) {
    const { done, value } = await reader.read();
    if (done) {
      isReading = false;
      break;
    }

    const parsed = appendEventData(buffer, decoder.decode(value, { stream: true }));
    buffer = parsed.buffer;

    for (const event of parsed.events) {
      if (!event.data) continue;
      const payload = JSON.parse(event.data);
      if (event.event === 'reaction_delta') {
        const text = payload.text || '';
        reaction += text;
        params.onDelta(text);
      } else if (event.event === 'reaction_done') {
        reaction = payload.reaction || reaction;
      } else if (event.event === 'score') {
        score = {
          reaction: payload.reaction || reaction,
          funnyScore: Number(payload.funnyScore ?? payload.funny_score ?? 0),
          reason: payload.reason || '',
          isSilence: payload.isSilence,
        };
      }
    }
  }

  if (score) return score;
  return { reaction, funnyScore: 0, reason: '裁判未返回评分' };
}

export function usePerform(apiConfig: ApiConfig): UsePerformReturn {
  const [reaction, setReaction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const currentLevel = useGameStore((s) => s.currentLevel);
  const submitResult = useGameStore((s) => s.submitResult);
  const updateRoundScore = useGameStore((s) => s.updateRoundScore);
  const roundsLength = useGameStore((s) => s.meter.rounds.length);

  const handlePerform = useCallback(
    async (performData: PerformRequestedData) => {
      if (isLoading) return;
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setIsLoading(true);
      setReaction('');
      setError(null);

      const controller = abortRef.current;
      const timeout = window.setTimeout(() => controller.abort(), 60000);
      const appendReaction = (text: string) => {
        setReaction((prev) => prev + text);
      };

      try {
        const audienceSystem = createAudiencePrompt(currentLevel);
        const userContent = createUserContent(performData, apiConfig.supportsImages);
        const messages: ChatMessage[] = [
          { role: 'system', content: audienceSystem },
          { role: 'user', content: userContent },
        ];

        let finalReaction = '';
        let funnyScore = 0;
        let reason = '';

        if (isLocalBaseUrl(apiConfig.baseUrl)) {
          try {
            finalReaction = await callChatStream({
              apiConfig,
              messages,
              maxTokens: 160,
              signal: controller.signal,
              onDelta: appendReaction,
            });
          } catch (streamErr) {
            console.warn('流式请求失败，降级为完整响应逐字显示:', streamErr);
            setReaction('');
            finalReaction = await callChatOnce({
              apiConfig,
              messages,
              maxTokens: 160,
              signal: controller.signal,
            });
            await typewriter(finalReaction, appendReaction);
          }

          const normalized = normalizeSilence(finalReaction, currentLevel);
          if (normalized.isSilence) setReaction(normalized.text);

          submitResult({
            reaction: normalized.text,
            funnyScore: 0,
            reason: '裁判正在打分…',
            props: performData.snapshot.props,
            chains: performData.snapshot.connections,
            motionSummary: performData.observation.graph.summary,
          });

          const roundIdx = roundsLength;
          const judgeSystem = `你是幽默反应分析系统。分析观众弹幕的情绪波动强度。不需要思考、推理、分析过程，直接输出JSON。评分锚点：0=无反应/敷衍，4-6=明确正面反馈，7-8=情绪强烈，9-10=失控。难度校准：LV1系数1.0，LV5系数2.5。只输出JSON，无其他字符：{"funny_score":0-10,"reason":"简短归因不超过15字"}`;
          const judgeResult = await callChatOnce({
            apiConfig,
            messages: [
              { role: 'system', content: judgeSystem },
              { role: 'user', content: `观众难度：${currentLevel}\n观众回复：${finalReaction || '(观众沉默)'}` },
            ],
            maxTokens: 80,
            signal: controller.signal,
          });

          try {
            const jsonMatch = judgeResult.match(/\{[\s\S]*"funny_score"[\s\S]*\}/);
            const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : judgeResult);
            funnyScore = Number(parsed.funny_score);
            reason = parsed.reason;
          } catch {
            funnyScore = 5;
            reason = '裁判打了个盹';
          }

          updateRoundScore(roundIdx, funnyScore, reason);
        } else {
          const proxyResult = await callPerformProxy({
            apiConfig,
            level: currentLevel,
            data: performData,
            signal: controller.signal,
            onDelta: appendReaction,
          });
          const normalized = normalizeSilence(proxyResult.reaction, currentLevel);
          if (normalized.isSilence) setReaction(normalized.text);

          submitResult({
            reaction: normalized.text,
            funnyScore: proxyResult.funnyScore,
            reason: proxyResult.reason,
            props: performData.snapshot.props,
            chains: performData.snapshot.connections,
            motionSummary: performData.observation.graph.summary,
          });
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          setError('AI 响应超时，请简化场景或重试');
        } else if (err instanceof TypeError) {
          setError('网络连接失败，请检查网络后重试');
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('发生未知错误，请稍后重试');
        }
        console.error('表演请求失败:', err);
      } finally {
        window.clearTimeout(timeout);
        setIsLoading(false);
      }
    },
    [apiConfig, currentLevel, isLoading, submitResult, updateRoundScore, roundsLength],
  );

  const dismissError = useCallback(() => setError(null), []);

  return { reaction, isLoading, error, handlePerform, dismissError };
}
