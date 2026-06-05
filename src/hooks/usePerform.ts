// ============================================================
// usePerform — 浏览器直连 AI API（README 5.2 节）
// 直接调用用户配置的 API Base URL + Key + Model
// ============================================================

import { useState, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { generateSceneDescription } from '@/utils/generateSceneDesc';
import type { PerformRequestedData } from '@/phaser/bridges/PhaserEventBus';
import type { ApiConfig } from '@/components/ApiKeyInput';

const SILENCE_MESSAGES: Record<number, string> = {
  1: '阿乐笑得说不出话了…',
  2: '小七："这集我看过了吧？"',
  3: '老陈潜水了，没有弹幕…',
  4: '林老师沉默地摇了摇头',
  5: '零号评审在笔记上写了些什么',
};

interface UsePerformReturn {
  reaction: string;
  isLoading: boolean;
  error: string | null;
  handlePerform: (data: PerformRequestedData) => Promise<void>;
  dismissError: () => void;
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

  const callAI = useCallback(
    async (
      systemPrompt: string,
      userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>,
      maxTokens: number,
    ): Promise<string> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiConfig.apiKey) {
        headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
      }

      // 判断是否本地地址，走 Vite 代理绕过 CORS
      const isLocal = apiConfig.baseUrl.includes('127.0.0.1') || apiConfig.baseUrl.includes('localhost');
      const apiUrl = isLocal
        ? '/api/chat/completions'
        : `${apiConfig.baseUrl}/chat/completions`;

      const userMessage = typeof userContent === 'string'
        ? { role: 'user' as const, content: userContent }
        : { role: 'user' as const, content: userContent };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: apiConfig.model,
          messages: [
            { role: 'system', content: systemPrompt },
            userMessage,
          ],
          max_tokens: maxTokens,
          temperature: 0.8,
          stream: false,
        }),
        signal: AbortSignal.timeout(60000), // 多模态请求可能更慢，增加超时
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
    },
    [apiConfig],
  );

  const handlePerform = useCallback(
    async (performData: PerformRequestedData) => {
      if (isLoading) return;
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setIsLoading(true);
      setReaction('');
      setError(null);

      try {
        const { snapshot, beforeScreenshot, afterScreenshot, effectDescriptions } = performData;
        const sceneDesc = generateSceneDescription(snapshot);

        // 构建多模态消息内容
        const effectText = effectDescriptions.length > 0
          ? `道具效果汇总：\n${effectDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`
          : '无特殊道具效果。';

        const textPrompt = `你是一个直播间观众，正在观看主播的"道具表演"。

场景描述：${sceneDesc}

${effectText}

下面有两张截图：
- 第一张是动画开始前的场景
- 第二张是道具动画播放3秒后的场景

请观察两张截图的差异（道具位置变化、粒子效果、动画等），结合道具效果描述，给出你的弹幕反应。`;

        // 构建 vision 格式的用户消息
        const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
          { type: 'text', text: textPrompt },
        ];

        // 如果截图可用，添加图片（多模态）
        if (beforeScreenshot && beforeScreenshot.startsWith('data:image/')) {
          userContent.push({ type: 'image_url', image_url: { url: beforeScreenshot } });
        }
        if (afterScreenshot && afterScreenshot.startsWith('data:image/')) {
          userContent.push({ type: 'image_url', image_url: { url: afterScreenshot } });
        }

        // 精简版观众提示词
        const AUDIENCE_PROMPTS: Record<number, string> = {
          1: `你是"阿乐"，直播间观众，笑点极低。什么都觉得好笑，只有血腥/暴力不笑。必带"哈哈哈哈"，高频词：笑死、绷不住、救命。1-2句话弹幕，不超过50字。不够好笑回"过"。不需要思考分析，直接说弹幕。`,
          2: `你是"小七"，冲浪达人，见过世面。一般烂活不感冒，创意玩法会兴奋。觉得好说"有点东西"，一般说"还行"，差说"看过"。1-2句话弹幕。不需要思考分析，直接说弹幕。`,
          3: `你是"老陈"，潜水老观众。大多数时候不发弹幕，只在真正有料时才开口。日常回"……"或"还行"，真被逗到回"草""绝了"。1-2句话弹幕，不超过50字。不够好笑回"过"。不需要思考分析，直接说弹幕。`,
          4: `你是"林老师"，戏剧评论人，极度挑剔。欣赏荒诞主义、结构错位。无感时安静，可取处说"有趣的结构"，真正被逗到说"精妙""bravo"。1-2句话弹幕。不够好笑回"过"。不需要思考分析，直接说弹幕。`,
          5: `你是"零号评审"，职业幽默鉴赏官，阅评超十万场。默认无情绪波动。99%回"嗯""知道了""下一个"，极罕见破防回"有点意思""不坏"。1句话不超过10字。不需要思考分析，直接说弹幕。`,
        };

        const audienceSystem = AUDIENCE_PROMPTS[currentLevel] || AUDIENCE_PROMPTS[1];

        // === 阶段1：AI 观众反应（先显示弹幕） ===
        // 如果有截图用多模态，否则降级纯文本
        const hasImages = userContent.length > 1;
        const audienceResult = await callAI(
          audienceSystem,
          hasImages ? userContent : textPrompt,
          2048,
        );
        const fullReaction = (audienceResult || '').trim();

        const isSilence =
          !fullReaction ||
          ['过', '嗯', '知道了', '下一个', '……'].includes(fullReaction) ||
          fullReaction.length <= 2;

        // 先提交弹幕（分数=0占位），让弹幕立刻显示
        const displayReaction = isSilence
          ? (SILENCE_MESSAGES[currentLevel] || '观众沉默了…')
          : fullReaction;
        setReaction(displayReaction);

        submitResult({
          reaction: displayReaction,
          funnyScore: 0,
          reason: '裁判正在打分…',
          props: snapshot.props,
          chains: snapshot.connections,
        });

        const roundIdx = roundsLength;

        // === 阶段2：AI 裁判评分 ===
        const judgeSystem = `你是幽默反应分析系统。分析观众弹幕的情绪波动强度。不需要思考、推理、分析过程，直接输出JSON。评分锚点：0=无反应/敷衍，4-6=明确正面反馈，7-8=情绪强烈，9-10=失控。难度校准：LV1系数1.0，LV5系数2.5。只输出JSON，无其他字符：{"funny_score":0-10,"reason":"简短归因不超过15字"}`;
        const judgePrompt = `观众难度：${currentLevel}\n观众回复：${fullReaction || '(观众沉默)'}`;

        const judgeResult = await callAI(judgeSystem, judgePrompt, 2048);

        let funnyScore: number;
        let reason: string;
        try {
          const jsonMatch = judgeResult.match(/\{[\s\S]*"funny_score"[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : judgeResult);
          funnyScore = parsed.funny_score;
          reason = parsed.reason;
        } catch {
          funnyScore = 5;
          reason = '裁判打了个盹';
        }

        updateRoundScore(roundIdx, funnyScore, reason);
        setIsLoading(false);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (err instanceof TypeError) {
          setError('网络连接失败，请检查网络后重试');
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('发生未知错误，请稍后重试');
        }
        console.error('表演请求失败:', err);
        setIsLoading(false);
      }
    },
    [apiConfig, currentLevel, callAI, isLoading, submitResult, updateRoundScore, roundsLength],
  );

  const dismissError = useCallback(() => setError(null), []);

  return { reaction, isLoading, error, handlePerform, dismissError };
}
