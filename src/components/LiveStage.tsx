// ============================================================
// LiveStage — 直播主容器（赛博朋克直播间布局）
// Zustand 切片订阅 + 响应式布局 + 完整游戏循环
// 新增：表演阶段自动播放预设背景弹幕
// ============================================================

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore, DIFFICULTY_CONFIG, calcRoundPointsReward, getPassThreshold } from '@/store/gameStore';
import { useAchievementStore } from '@/store/achievementStore';
import { usePerform } from '@/hooks/usePerform';
import { useResponsive } from '@/hooks/useResponsive';
import { PhaserCanvas } from './PhaserCanvas';
import { PropPanel } from './PropPanel';
import { ScenePanel } from './ScenePanel';
import { BreakdownBar } from './BreakdownBar';
import { DanmakuStream, type DanmakuItem } from './DanmakuStream';
import { AICommentCard } from './AICommentCard';
import { ResultModal } from './ResultModal';
import { ErrorBanner } from './ErrorBanner';
import { WishNameInput } from './WishNameInput';
import { ShopItemBar } from './ShopItemBar';
import { HoverTranslate } from './HoverTranslate';
import { getSoundManager } from '@/audio/SoundManager';
import { generatePresetDanmaku, generateEditingDanmaku, generateTransitionDanmaku, randomOffensive } from '@/data/presetDanmaku';
import { AUDIENCE_OPENING_LINES } from '@/data/bossOpeningLines';
import { eventBus } from '@/phaser/bridges/PhaserEventBus';
import type { ApiConfig } from './ApiKeyInput';
import { PROP_LIST, PROP_MANIFEST, type PropKey } from '@/phaser/assets/manifest';
import { SCENE_CONFIGS, type SceneType } from '@/types';

interface LiveStageProps {
  apiConfig: ApiConfig;
  onBackToMenu: () => void;
  onBackToConfig: () => void;
  onGoShop?: () => void;
}

/** 弹幕加速标记：当玩家操作或表演开始时，短暂加速弹幕 */
let danmakuBoostUntil = 0;
/** 设置弹幕加速（毫秒） */
const triggerDanmakuBoost = (duration: number) => {
  danmakuBoostUntil = Math.max(danmakuBoostUntil, Date.now() + duration);
};

/** 手机端弹幕降速因子（1.0=正常，移动端自动设为 ~2.0） */
let mobileDanmakuFactor = 1.0;
export const setMobileDanmakuFactor = (v: number) => { mobileDanmakuFactor = v; };

/** 弹幕刷屏曲线参数（活人感版）
 *  三大特征模拟真实直播间：
 *  1. 随机抖动大（不是匀速发射）
 *  2. 呼吸感节奏（偶尔密集→偶尔稀疏→再密集）
 *  3. 突发爆发（多人同时发言）
 *  4. 玩家操作/表演开始加速
 */
function getDanmakuInterval(round: number, phaseElapsed: number): number {
  // 基础间隔随回合递减
  let base = Math.max(120, 1800 - round * 160);

  // 表演开始前15秒额外加速（弹幕狂欢）
  if (phaseElapsed < 15000) {
    base = Math.max(80, base * 0.55);
  }

  // 呼吸感：前30秒较慢，30-60秒加速，60秒后剧烈波动
  let breathFactor = 1.0;
  if (phaseElapsed < 30000) {
    breathFactor = 1.1 + Math.random() * 0.3; // 开头有小幅波动
  } else if (phaseElapsed < 60000) {
    breathFactor = 0.7 + Math.random() * 0.4; // 中段加速有波动
  } else {
    // 后段：大幅随机波动，模拟高潮和冷却交替
    breathFactor = 0.5 + Math.random() * 1.0;
  }

  // 大幅随机抖动（100%范围），打破死板节奏
  const jitter = Math.random() * base * 1.0;

  let interval = Math.floor(base * 0.35 * breathFactor + jitter);

  // 弹幕加速期：间隔减半
  if (Date.now() < danmakuBoostUntil) {
    interval = Math.max(80, Math.floor(interval * 0.4));
  }

  // 手机端降速
  interval = Math.floor(interval * mobileDanmakuFactor);

  return interval;
}

/** 计算本轮要发射的弹幕数量（爆发机制，更随机） */
function getDanmakuBurstCount(round: number, phaseElapsed: number): number {
  const roll = Math.random();
  // 表演开始前15秒爆发更强
  const earlyBoost = phaseElapsed < 15000 ? 0.12 : 0;
  // 增加爆发概率，让节奏更有高潮感
  if (round >= 8 && roll > 0.78 - earlyBoost) return Math.floor(3 + Math.random() * 3); // 8+回合：~22-34%概率爆发3-5条
  if (round >= 5 && roll > 0.85 - earlyBoost) return Math.floor(2 + Math.random() * 2); // 5+回合：~15-27%概率爆发2-3条
  if (roll > 0.65 - earlyBoost) return 2; // ~35-47%概率双条
  // 弹幕加速期额外爆发
  if (Date.now() < danmakuBoostUntil && roll > 0.5) return 2;
  return 1;
}

/** 计算编辑阶段弹幕间隔（活人感版） */
function getEditingInterval(): number {
  // 弹幕加速期大幅提速
  if (Date.now() < danmakuBoostUntil) {
    return Math.floor((150 + Math.random() * 600) * mobileDanmakuFactor);
  }
  // 1.0-5.0秒，大幅随机，模拟真实直播间等待状态
  const base = 1200;
  const jitter = Math.random() * 3800;
  // 8%概率极快（多人同时催促），8%概率极慢（安静等待）
  if (Math.random() < 0.08) return Math.floor((200 + Math.random() * 250) * mobileDanmakuFactor); // 极快
  if (Math.random() < 0.08) return Math.floor((3500 + Math.random() * 2500) * mobileDanmakuFactor); // 极慢
  return Math.floor((base + jitter) * mobileDanmakuFactor);
}

export function LiveStage({ apiConfig, onBackToMenu, onBackToConfig, onGoShop }: LiveStageProps) {
  const bp = useResponsive();
  const sound = getSoundManager();

  // Zustand 切片订阅
  const phase = useGameStore((s) => s.phase);
  const meterValue = useGameStore((s) => s.meter.value);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const currentRound = useGameStore((s) => s.currentRound);
  const maxRounds = useGameStore((s) => s.maxRounds);
  const mode = useGameStore((s) => s.mode);
  const difficulty = useGameStore((s) => s.difficulty);
  const rounds = useGameStore((s) => s.meter.rounds);
  const judgeDismissedRound = useGameStore((s) => s.judgeDismissedRound);
  const dismissJudgeCard = useGameStore((s) => s.dismissJudgeCard);
  const forceSettle = useGameStore((s) => s.forceSettle);
  const difficultyName = DIFFICULTY_CONFIG[currentLevel]?.name || 'UNKNOWN';
  const points = useGameStore((s) => s.points);
  const passThreshold = getPassThreshold(currentLevel, difficulty);
  const sceneType = useGameStore((s) => s.sceneType);
  const setSceneType = useGameStore((s) => s.setSceneType);
  const unlockedScenes = useGameStore((s) => s.unlockedScenes);

  // usePerform hook
  const { reaction, isLoading, error, handlePerform, dismissError } = usePerform(apiConfig);

  // 预设弹幕状态
  const [presetDanmaku, setPresetDanmaku] = useState<DanmakuItem[]>([]);
  const presetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstTimeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const presetIdRef = useRef(0);
  const phaseStartTimeRef = useRef<number>(0);
  const transitionFiredRef = useRef(false); // 过渡爆发是否已触发
  const openingLineFiredLevelRef = useRef(0);

  // ============================================================
  // 普通观众开场 SC：关卡首次进入编辑阶段时延迟1秒注入 SuperChat
  // ============================================================
  const openingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  useEffect(() => {
    if (
      mode === 'story'
      && phase === 'editing'
      && currentLevel > 0
      && openingLineFiredLevelRef.current !== currentLevel
    ) {
      const opening = AUDIENCE_OPENING_LINES[currentLevel];
      if (!opening) return;

      openingTimerRef.current = setTimeout(() => {
        openingLineFiredLevelRef.current = currentLevel;
        const openingItem: DanmakuItem = {
          text: opening.text,
          score: 10,
          round: currentLevel,
          audienceOpening: opening,
          senderName: opening.viewerName,
        };
        allDanmakuRef.current = [openingItem, ...allDanmakuRef.current];
        setListVersion((v) => v + 1);
        sound.play('perform_start');
      }, 1000);
    }
    return () => {
      if (openingTimerRef.current) {
        clearTimeout(openingTimerRef.current);
        openingTimerRef.current = null;
      }
    };
  }, [mode, phase, currentLevel, sound]);

  // ============================================================
  // 玩家放置道具时触发弹幕加速 + 5+道具成就检测
  // ============================================================
  const placedCountRef = useRef(0);
  useEffect(() => {
    const unsub = eventBus.on('prop-placed', () => {
      placedCountRef.current += 1;
      triggerDanmakuBoost(3000);
      // 摆放 5 个以上道具（含主角）即时触发成就
      if (placedCountRef.current >= 5) {
        useAchievementStore.getState().unlock('props_5plus');
      }
    });
    return unsub;
  }, []);

  // 新回合/新局重置计数
  useEffect(() => {
    const unsub = useGameStore.subscribe((state, prevState) => {
      if (state.currentRound !== prevState.currentRound || state.phase === 'editing' && prevState.phase === 'result') {
        placedCountRef.current = 0;
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = eventBus.on('scene-error', (data: unknown) => {
      const { error } = data as { error?: Error };
      setStageError(error?.message || '舞台操作失败');
    });
    return unsub;
  }, []);

  // ============================================================
  // 关卡提示开关（舞台底部显示，默认关闭）
  // ============================================================
  const [showLevelHint, setShowLevelHint] = useState(false);
  const levelHint = AUDIENCE_OPENING_LINES[currentLevel];

  // 预设弹幕随机观众名
  const viewerNames = useMemo(() => [
    'CyberGhost', 'NeonDrifter', 'GlitchHunter', 'DataRunner',
    'PixelPunk', 'VoidWalker', 'NetRunner_77', 'ChromeHeart',
    'SynthWave', 'ByteBandit', 'QuantumLeap', 'NeonNinja',
    'CodeBreaker', 'DigitalSoul', 'MatrixMage', 'FluxCapacitor',
    'SteinsGater_048', 'ChiralWalker_21', 'NERV_Operator_01',
    'SpaceCowboy_Bebop', 'LaughingMan_001', 'Vash_Stampede_$60B',
    '赛博阿乐', '霓虹小七', '全息老陈', '加密王师傅',
    '电子猫猫', '虚空旅人', '像素拾荒者', '缓冲区幽灵',
    '404NotFound', '神经网络猫', '递归函数','赛博仓鼠',
  ], []);
  const randomNameRef = useRef(0);
  const getRandomViewerName = useCallback(() => {
    randomNameRef.current += 1;
    // 80%概率英文名，20%概率中文名（中文名在数组后半段，索引22+）
    if (Math.random() < 0.8) {
      return viewerNames[randomNameRef.current % 22]; // 前22个是英文名
    }
    return viewerNames[22 + (randomNameRef.current % (viewerNames.length - 22))];
  }, [viewerNames]);

  const fireDanmakuBurst = useCallback((generator: () => string, count: number, allowOffensive = false) => {
    for (let i = 0; i < count; i++) {
      // 爆发时稍微错开时间，避免完全同步
      const delay = i === 0 ? 0 : Math.random() * 150;
      const tid = setTimeout(() => {
        burstTimeoutIdsRef.current.delete(tid);
        // 12%概率混入攻击性弹幕（仅表演阶段）
        const isOffensive = allowOffensive && Math.random() < 0.12;
        const text = isOffensive ? randomOffensive() : generator();
        presetIdRef.current += 1;
        setPresetDanmaku((prev) => [
          ...prev,
          {
            text,
            score: 0,
            round: presetIdRef.current,
            isPreset: true,
            isOffensive,
            senderName: getRandomViewerName(),
          },
        ]);
      }, delay);
      burstTimeoutIdsRef.current.add(tid);
    }
  }, []);

  /** 自动播放预设弹幕 — 三阶段逻辑
   *  editing: 等待催促型（慢节奏，大幅随机）
   *  performing → 过渡爆发: 点击开始瞬间0.8秒内刷5-8条短词
   *  performing → 常态: 基于回合数的活人感节奏
   */
  useEffect(() => {
    // 清除之前的定时器
    if (presetTimerRef.current) {
      clearTimeout(presetTimerRef.current);
      presetTimerRef.current = null;
    }

    if (phase === 'editing') {
      // 每次进入编辑阶段，重置过渡标记
      transitionFiredRef.current = false;
      phaseStartTimeRef.current = Date.now();
      // 进入编辑时短暂加速（模拟观众对上一轮结果的讨论）
      if (currentRound > 0) triggerDanmakuBoost(2500);

      // 编辑阶段：大幅随机间隔
      const scheduleNext = () => {
        const interval = getEditingInterval();
        // 弹幕加速期双条概率提升到40%，模拟观众激烈讨论
        const doubleChance = Date.now() < danmakuBoostUntil ? 0.40 : 0.10;
        const count = Math.random() > (1 - doubleChance) ? 2 : 1;
        presetTimerRef.current = setTimeout(() => {
          fireDanmakuBurst(generateEditingDanmaku, count);
          scheduleNext();
        }, interval);
      };
      scheduleNext();
    } else if (phase === 'performing') {
      phaseStartTimeRef.current = Date.now();
      // 表演开始：触发弹幕加速（前6秒观众兴奋刷屏）
      triggerDanmakuBoost(6000);

      // === 过渡阶段：点击开始后0.8秒内爆发5-8条短词 ===
      if (!transitionFiredRef.current) {
        transitionFiredRef.current = true;
        const burstSize = 5 + Math.floor(Math.random() * 4); // 5-8条
        // 爆发：每条间隔50-150ms，模拟直播间刷屏
        for (let i = 0; i < burstSize; i++) {
          const delay = 50 + Math.random() * 100 * i; // 递增错开
          const tid = setTimeout(() => {
            burstTimeoutIdsRef.current.delete(tid);
            const text = generateTransitionDanmaku();
            presetIdRef.current += 1;
            setPresetDanmaku((prev) => [
              ...prev,
              { text, score: 0, round: presetIdRef.current, isPreset: true, senderName: getRandomViewerName() },
            ]);
          }, delay);
          burstTimeoutIdsRef.current.add(tid);
        }

        // 爆发结束后（约0.8秒）开始常态弹幕
        const transitionEndDelay = 800 + Math.random() * 200;
        presetTimerRef.current = setTimeout(() => {
          // 常态表演阶段弹幕
          const scheduleNext = () => {
            const elapsed = Date.now() - phaseStartTimeRef.current;
            const interval = getDanmakuInterval(currentRound, elapsed);
            const burstCount = getDanmakuBurstCount(currentRound, elapsed);
            presetTimerRef.current = setTimeout(() => {
              fireDanmakuBurst(generatePresetDanmaku, burstCount, true);
              scheduleNext();
            }, interval);
          };
          scheduleNext();
        }, transitionEndDelay);
      } else {
        // 已触发过过渡（比如回合更新时），直接常态
        const scheduleNext = () => {
          const elapsed = Date.now() - phaseStartTimeRef.current;
          const interval = getDanmakuInterval(currentRound, elapsed);
          const burstCount = getDanmakuBurstCount(currentRound, elapsed);
          presetTimerRef.current = setTimeout(() => {
            fireDanmakuBurst(generatePresetDanmaku, burstCount, true);
            scheduleNext();
          }, interval);
        };
        scheduleNext();
      }
    } else {
      // 其他阶段（judging/result）：暂停预设弹幕但不删除已有内容
    }

    return () => {
      // 清除计划中的定时器
      if (presetTimerRef.current) {
        clearTimeout(presetTimerRef.current);
        presetTimerRef.current = null;
      }
      // 清除所有爆发弹幕的定时器
      for (const tid of burstTimeoutIdsRef.current) {
        clearTimeout(tid);
      }
      burstTimeoutIdsRef.current.clear();
    };
  }, [phase, currentRound, fireDanmakuBurst]);

  // ============================================================
  // 弹幕列表合并逻辑：
  // - AI 弹幕（Super Chat）永远保留
  // - 预设弹幕永远保留，穿插在 AI 弹幕之间
  // - 两者都不设上限，用户可滚动回看全部历史
  // ============================================================

  // 持久化所有弹幕（不截断、不清空）
  const allDanmakuRef = useRef<DanmakuItem[]>([]);

  // 同步 AI 弹幕：增量追加新回合，不删除旧数据
  const prevRoundsLenRef = useRef(0);
  useEffect(() => {
    if (rounds.length > prevRoundsLenRef.current) {
      // 有新回合，追加新的 AI 弹幕
      const newItems: DanmakuItem[] = [];
      const fixedSenderName = AUDIENCE_OPENING_LINES[currentLevel]?.viewerName;
      for (let i = prevRoundsLenRef.current; i < rounds.length; i++) {
        const r = rounds[i];
        newItems.push({
          text: r.reaction,
          score: r.funnyScore,
          round: i + 1,
          pointsReward: calcRoundPointsReward(r.funnyScore, difficulty),
          senderName: fixedSenderName,
        });
      }
      allDanmakuRef.current = [...allDanmakuRef.current, ...newItems];
    }
    prevRoundsLenRef.current = rounds.length;
  }, [rounds, currentLevel, difficulty]);

  // 同步预设弹幕：增量追加，不删除旧数据
  const prevPresetLenRef = useRef(0);
  useEffect(() => {
    if (presetDanmaku.length > prevPresetLenRef.current) {
      const newItems = presetDanmaku.slice(prevPresetLenRef.current);
      allDanmakuRef.current = [...allDanmakuRef.current, ...newItems];
    }
    prevPresetLenRef.current = presetDanmaku.length;
  }, [presetDanmaku]);

  // 渲染列表：直接使用持久化的 ref
  // 当 ref 变化时触发渲染（用简单的计数器）
  const [listVersion, setListVersion] = useState(0);
  useEffect(() => {
    setListVersion((v) => v + 1);
  }, [rounds, presetDanmaku]);

  const danmakuList = useMemo<DanmakuItem[]>(() => {
    // 每次 rounds 或 presetDanmaku 变化时重新读取 ref
    // 注入 _index 以便 DanmakuStream 切片后仍能正确双删除
    return allDanmakuRef.current.map((item, i) => ({ ...item, _index: i }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listVersion]);

  const deletedCountRef = useRef(0);
  const sentCountRef = useRef(0);
  const offensiveDeletedRef = useRef(0);

  /** 双击移除弹幕 */
  const handleRemoveDanmaku = useCallback((index: number) => {
    const item = allDanmakuRef.current[index];
    allDanmakuRef.current = allDanmakuRef.current.filter((_, i) => i !== index);
    setListVersion((v) => v + 1);
    deletedCountRef.current++;
    if (deletedCountRef.current >= 5) {
      useAchievementStore.getState().unlock('danmaku_sweeper');
    }
    // 删除攻击性弹幕追踪
    if (item?.isOffensive) {
      offensiveDeletedRef.current++;
      if (offensiveDeletedRef.current >= 3) {
        useAchievementStore.getState().unlock('danmaku_cleaner');
      }
    }
  }, []);

  /** 用户发送快捷弹幕 */
  const handleSendQuick = useCallback((text: string) => {
    const item: DanmakuItem = {
      text,
      score: 0,
      round: currentRound,
      isPreset: true,
      senderName: 'Player',
    };
    allDanmakuRef.current = [...allDanmakuRef.current, item];
    setListVersion((v) => v + 1);
    sentCountRef.current++;
    if (sentCountRef.current === 1) {
      useAchievementStore.getState().unlock('first_danmaku');
    }
    if (sentCountRef.current >= 10) {
      useAchievementStore.getState().unlock('danmaku_spammer');
    }
    // 弹幕关键词成就检测
    const lower = text.toLowerCase();
    if (text.includes('原神')) useAchievementStore.getState().unlock('genshin_impact');
    if (text.includes('狗头') || text.includes('🐶')) useAchievementStore.getState().unlock('dog_head');
    if (lower.includes('awsl') || text.includes('啊我死了')) useAchievementStore.getState().unlock('awsl');
    if (text.includes('666')) useAchievementStore.getState().unlock('double_666');
    if (text.includes('腾讯')) useAchievementStore.getState().unlock('tencent_old_dry');
    if (text.includes('老铁')) useAchievementStore.getState().unlock('lao_tie');
    if (text.includes('鸣潮')) useAchievementStore.getState().unlock('mingchao');
    if (text.length > 30) useAchievementStore.getState().unlock('long_text');
    const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}]/gu) || []).length;
    if (emojiCount >= 3) useAchievementStore.getState().unlock('emoji_master');
  }, [currentRound]);

  const isMobile = bp === 'mobile';
  const [mobilePanel, setMobilePanel] = useState<'props' | 'scenes' | null>(null);
  const [danmakuExpanded, setDanmakuExpanded] = useState(false);

  // 手机端弹幕降速
  useEffect(() => { setMobileDanmakuFactor(isMobile ? 2.2 : 1.0); }, [isMobile]);

  // 手机端道具触摸拖拽状态
  const [dragProp, setDragProp] = useState<{ key: PropKey; x: number; y: number; startX: number; startY: number } | null>(null);
  const dragTouchIdRef = useRef<number | null>(null);

  // ============================================================
  // BOSS SC 弹窗（手机端：AI SuperChat 自动弹出）
  // ============================================================
  const [bossScPopup, setBossScPopup] = useState<DanmakuItem | null>(null);
  const bossScTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAiDanmakuCountRef = useRef(0);

  // 监听新 AI 弹幕 → 弹出 BOSS SC 弹窗
  useEffect(() => {
    if (!isMobile) return;
    const aiItems = danmakuList.filter((d) => !d.isPreset && !d.audienceOpening);
    const currentCount = aiItems.length;
    if (currentCount > lastAiDanmakuCountRef.current && currentCount > 0) {
      const latest = aiItems[aiItems.length - 1];
      setBossScPopup(latest);
      // 自动关闭计时
      if (bossScTimerRef.current) clearTimeout(bossScTimerRef.current);
      bossScTimerRef.current = setTimeout(() => setBossScPopup(null), 8000);
    }
    lastAiDanmakuCountRef.current = currentCount;
  }, [danmakuList, isMobile]);

  // 模拟在线人数（与绷不住值正相关 + 大幅随机波动，允许减少）
  // meterValue 0→base 8000, meterValue 100→base 35000
  const baseViewers = 8000 + meterValue * 270;
  const [viewerCount, setViewerCount] = useState(() =>
    Math.floor(baseViewers + (Math.random() - 0.5) * 400)
  );

  // 许愿机输入浮层状态
  const [wishInput, setWishInput] = useState<{ propId: string } | null>(null);
  useEffect(() => {
    const interval = setInterval(() => {
      const target = baseViewers;
      setViewerCount((prev) => {
        const drift = (target - prev) * 0.25;
        // 大幅随机：可能暴增也可能暴跌
        const roll = Math.random();
        let jitter: number;
        if (roll > 0.92) {
          jitter = -Math.floor(Math.random() * 2000); // 8% 概率暴跌 0~2000
        } else if (roll > 0.85) {
          jitter = Math.floor(Math.random() * 2500);   // 7% 概率暴涨 0~2500
        } else {
          jitter = Math.floor((Math.random() - 0.5) * 800); // 正常波动 ±400
        }
        return Math.max(100, Math.min(99999, Math.round(prev + drift + jitter)));
      });
    }, 2000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [baseViewers]);

  // 监听许愿机名字输入请求
  useEffect(() => {
    const unsubscribe = eventBus.on('request-wish-name', (data: unknown) => {
      const { propId } = data as { propId: string };
      setWishInput({ propId });
    });
    return () => unsubscribe();
  }, []);

  const handleWishConfirm = (propId: string, name: string) => {
    eventBus.emit('wish-name-set', { propId, name });
    setWishInput(null);
  };

  const handleWishCancel = () => {
    setWishInput(null);
  };

  const handleMobilePlaceProp = useCallback((key: PropKey) => {
    const jitter = Math.random() * 120 - 60;
    eventBus.emit('request-place-prop', {
      key,
      x: Math.round(640 + jitter),
      y: Math.round(500 + jitter * 0.35),
    });
  }, []);

  /** 手机端触摸拖拽开始 */
  const handlePropTouchStart = useCallback((e: React.TouchEvent, key: PropKey) => {
    const touch = e.touches[0];
    dragTouchIdRef.current = touch.identifier;
    setDragProp({ key, x: touch.clientX, y: touch.clientY, startX: touch.clientX, startY: touch.clientY });
  }, []);

  /** 手机端触摸拖拽移动 */
  const handlePropTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragTouchIdRef.current === null) return;
    const touch = Array.from(e.touches).find(t => t.identifier === dragTouchIdRef.current);
    if (!touch) return;
    setDragProp(prev => prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null);
  }, []);

  /** 手机端放置道具（计算画布坐标） */
  const placePropAtTouch = useCallback((clientX: number, clientY: number, key: PropKey) => {
    const canvas = document.querySelector('.phaser-container canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    if (relX >= -20 && relY >= -20 && relX <= rect.width + 20 && relY <= rect.height + 20) {
      const scaleX = 1280 / rect.width;
      const scaleY = 960 / rect.height;
      const worldX = Math.round(Math.max(0, Math.min(1280, relX * scaleX)));
      const worldY = Math.round(Math.max(0, Math.min(960, relY * scaleY)));
      eventBus.emit('request-place-prop', { key, x: worldX, y: worldY });
      return true;
    }
    return false;
  }, []);

  /** 手机端触摸结束 */
  const handlePropTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragProp) return;
    const touch = Array.from(e.changedTouches).find(t => t.identifier === dragTouchIdRef.current);
    dragTouchIdRef.current = null;
    if (touch) {
      const dx = touch.clientX - dragProp.startX;
      const dy = touch.clientY - dragProp.startY;
      // 短距离触摸 = 点击放置（默认位置）
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
        handleMobilePlaceProp(dragProp.key);
      } else {
        placePropAtTouch(touch.clientX, touch.clientY, dragProp.key);
      }
    }
    setDragProp(null);
    setMobilePanel(null);
  }, [dragProp, handleMobilePlaceProp, placePropAtTouch]);

  /** 注入手机端 TikTok 弹幕动画 */
  useEffect(() => {
    if (!isMobile) return;
    const id = 'tiktok-danmaku-keyframes';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes tiktok-fade-up {
        0% { opacity: 0; transform: translateY(12px); }
        10% { opacity: 0.75; transform: translateY(0); }
        85% { opacity: 0.75; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-6px); }
      }
      @keyframes tiktok-enter {
        from { opacity: 0; transform: translateX(16px) scale(0.95); }
        to { opacity: 1; transform: translateX(0) scale(1); }
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [isMobile]);

  const handleMobileSceneSelect = useCallback((key: SceneType) => {
    if (key === sceneType) return;
    if (!unlockedScenes.includes(key)) {
      const scene = SCENE_CONFIGS.find((item) => item.key === key);
      eventBus.emit('scene-error', { error: new Error(`场景未解锁！请先在公会购买「${scene?.labelCn ?? '场景'}许可」`) });
      return;
    }
    const changed = setSceneType(key);
    if (!changed) {
      const scene = SCENE_CONFIGS.find((item) => item.key === key);
      eventBus.emit('scene-error', { error: new Error(`头肯不足！切换${scene?.labelCn ?? '场景'}需要 ${scene?.cost ?? 0} 头肯`) });
      return;
    }
    eventBus.emit('request-set-scene', { key });
  }, [sceneType, setSceneType, unlockedScenes]);

  const visibleError = error || stageError;
  const dismissVisibleError = () => {
    if (error) dismissError();
    else setStageError(null);
  };

  const mobileProps = useMemo(
    () => [...PROP_LIST].sort((a, b) => PROP_MANIFEST[a].cost - PROP_MANIFEST[b].cost),
    [],
  );

  return (
    <div className="live-stage h-full min-h-0 flex flex-col bg-game-bg relative">
      {/* 扫描线背景 */}
      <div className="absolute inset-0 scanlines pointer-events-none" />

      {/* === 顶栏：直播间标题栏（桌面 OBS 风格 / 手机悬浮覆盖）=== */}
      <div className={`shrink-0 border-b border-game-border bg-game-surface/80 backdrop-blur-sm relative z-10 ${
        isMobile ? '!absolute !top-0 !left-0 !right-0 !z-30 !bg-gradient-to-b !from-black/85 !to-black/50 !backdrop-blur-md !border-game-border/20' : ''
      }`}>
        <div className="panel-pattern" aria-hidden="true" />
        {/* 顶部霓虹条 */}
        <div className="h-[2px] bg-gradient-to-r from-accent via-accent-secondary to-accent-tertiary" />

        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
          {/* 左侧：直播状态 */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="live-badge">LIVE</span>
            <span className="status-icon hidden md:inline-flex text-accent-secondary" aria-hidden="true">REC</span>
            {/* 头肯 HUD */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-accent/10 border border-accent/30 rounded">
              <span className="text-xs">💰</span>
              <span className="font-data text-xs text-accent font-bold">{points}</span>
              <span className="font-data text-[10px] text-game-text-dim">头肯</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              <span className="font-data text-xs text-viewer-count">
                {viewerCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 中间：绷不住值进度条 */}
          <div className="order-3 basis-full min-w-0 sm:order-none sm:basis-auto sm:flex-1" data-tutorial="game-breakdown-bar">
            <BreakdownBar
              value={meterValue}
              level={currentLevel}
              round={currentRound}
              maxRounds={maxRounds}
              mode={mode}
              difficulty={difficulty}
              passThreshold={passThreshold}
              onForceSettle={forceSettle}
            />
          </div>

          {/* 右侧：控制按钮 */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              onClick={() => { sound.play('ui_button_press'); onBackToMenu(); }}
              onMouseEnter={() => sound.play('ui_button_hover')}
              title="返回直播间主页"
              className="group px-2 py-1 border border-game-border text-[10px] font-cyber text-game-text-dim
                         hover:border-accent hover:text-accent transition-all tracking-wider"
            >
              <HoverTranslate text="EXIT" hoverText="返回" />
            </button>
            <button
              onClick={() => { sound.play('ui_button_press'); onBackToConfig(); }}
              onMouseEnter={() => sound.play('ui_button_hover')}
              title="编辑信号配置"
              className="group px-2 py-1 border border-game-border text-[10px] font-cyber text-game-text-dim
                         hover:border-accent-secondary hover:text-accent-secondary transition-all tracking-wider"
            >
              <HoverTranslate text="SIGNAL" hoverText="信号" />
            </button>
          </div>
        </div>
      </div>

      {/* 商店道具快速使用栏 */}
      <ShopItemBar />

      {/* 错误提示 */}
      {visibleError && <ErrorBanner message={visibleError} onDismiss={dismissVisibleError} />}

      {/* 手机端右上角提示按钮（live-stage 直接子级，避免被顶栏遮挡） */}
      {isMobile && mode === 'story' && levelHint && (
        <button
          onClick={() => { sound.play('ui_button_press'); setShowLevelHint(!showLevelHint); }}
          className="fixed top-3 right-3 z-[9995] touch-target w-11 h-11 flex items-center justify-center
                     rounded-full bg-yellow-500/20 backdrop-blur-md border-2 border-yellow-400/60
                     shadow-lg shadow-yellow-500/20
                     active:bg-yellow-500/40 active:scale-90 transition-all
                     animate-pulse"
        >
          <span className="text-xl">💡</span>
        </button>
      )}

      {/* === 主体区域：响应式布局 === */}
      <div
        className={`flex-1 min-h-0 flex overflow-hidden relative z-10 ${
          isMobile ? 'flex-col' : 'flex-row'
        }`}
      >
        {/* 道具面板（左侧，画布外） */}
        {!isMobile && <div data-tutorial="game-prop-panel" className="flex flex-col min-h-0"><PropPanel /></div>}

        {/* 场景设定选择栏（道具面板与画布之间） */}
        {!isMobile && <ScenePanel />}

        {isMobile ? (
          /* ============================================================
             手机 TikTok 直播布局：
             全屏画布 + 弹幕浮层覆盖 + 底部浮动工具栏
             ============================================================ */
          <>
            {/* 全屏画布区 */}
            <div className="flex-1 min-h-0 relative overflow-hidden">
              <div className="absolute inset-0">
                <PhaserCanvas onPerform={handlePerform} disabled={isLoading} />
              </div>

              {/* AI 质检员评论（底部覆盖） */}
              <div className="absolute bottom-0 left-0 right-0 max-h-[38%] overflow-hidden z-10">
                <AICommentCard />
              </div>

              {/* 当前反应（表演中） */}
              {isLoading && reaction && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm border-t border-accent/40 animate-fade-in z-10">
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse shrink-0" />
                    <span className="font-cyber text-[10px] text-accent tracking-wider shrink-0">PROCESSING</span>
                    <p className="text-sm text-accent font-data truncate">{reaction}</p>
                  </div>
                </div>
              )}

              {/* 继续下一回合按钮 */}
              {phase === 'editing' && rounds.length > 0 && judgeDismissedRound < rounds.length && (
                <div className="absolute inset-0 flex items-center justify-center z-20 animate-fade-in">
                  <button
                    onClick={() => { sound.play('ui_button_press'); dismissJudgeCard(); }}
                    className="px-4 py-2.5 border-2 border-accent bg-game-surface/90 backdrop-blur-md
                               text-accent font-cyber text-[11px] tracking-widest
                               hover:bg-accent hover:text-black transition-all duration-300
                               shadow-lg shadow-accent/20 active:scale-95 rounded-sm"
                  >
                    ◈ 质检员已出报告 — 继续 ◈
                  </button>
                </div>
              )}

              {/* 关卡提示弹窗（保持复用） */}
              {showLevelHint && levelHint && (
                isMobile ? (
                  /* 手机端：居中弹窗 */
                  <div className="fixed inset-0 z-[9998] flex items-center justify-center animate-fade-in">
                    <div className="absolute inset-0 bg-black/70" onClick={() => { sound.play('ui_button_press'); setShowLevelHint(false); }} />
                    <div className="relative mx-4 w-full max-w-[320px] rounded-xl overflow-hidden border-2 border-yellow-500/40 shadow-2xl shadow-yellow-500/20 animate-scale-in"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-gradient-to-r from-yellow-600/90 via-yellow-500/80 to-amber-400/90 px-4 py-3 flex items-center gap-2">
                        <span className="text-2xl">💡</span>
                        <div className="flex-1">
                          <p className="font-cyber text-sm text-black tracking-wider font-bold">关卡提示</p>
                          {levelHint.viewerName && (
                            <p className="font-data text-[10px] text-black/60">第 {currentLevel} 关</p>
                          )}
                        </div>
                        <button
                          onClick={() => { sound.play('ui_button_press'); setShowLevelHint(false); }}
                          className="text-black/50 hover:text-black text-lg touch-target"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="bg-game-surface px-4 py-4">
                        <p className="font-data text-sm text-yellow-100/90 leading-relaxed">
                          {levelHint.hintTip}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 桌面端：右上角小弹窗 */
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowLevelHint(false)} />
                    <div className="absolute top-4 right-4 z-[9999] w-56 animate-fade-in">
                      <div className="bg-game-surface border border-yellow-500/30 rounded-md p-3 shadow-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-lg shrink-0">💡</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-cyber text-[10px] text-yellow-400 tracking-wider mb-1">关卡提示</p>
                            <p className="font-data text-[10px] text-yellow-100/80 leading-relaxed">{levelHint.hintTip}</p>
                          </div>
                          <button
                            onClick={() => { sound.play('ui_button_press'); setShowLevelHint(false); }}
                            className="text-yellow-400/50 hover:text-yellow-300 text-xs shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )
              )}

              {/* 弹幕覆盖层（左下角透明滚动，TikTok 直播风格） */}
              <div className="absolute bottom-12 left-0 right-0 z-15 pointer-events-none">
                <div className="flex flex-col items-start px-2 py-1 gap-1 overflow-hidden" style={{ maxHeight: '38vh', maskImage: 'linear-gradient(to top, transparent 0%, black 15%, black 85%, transparent 100%)' }}>
                  {danmakuList.slice(-8).reverse().map((item, i) => {
                    const key = `tdk-${item.round}-${item.text?.slice(0,8) ?? ''}-${i}`;
                    const realIndex = allDanmakuRef.current.length - 1 - i;
                    return (
                      <div
                        key={key}
                        className="px-2 py-0.5 rounded max-w-[82%] pointer-events-auto cursor-pointer select-none active:opacity-60 transition-opacity"
                        style={{
                          background: item.isPreset
                            ? 'rgba(0,0,0,0.35)'
                            : 'linear-gradient(90deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 100%)',
                          backdropFilter: 'blur(3px)',
                          WebkitBackdropFilter: 'blur(3px)',
                          animation: `tiktok-enter 0.3s ease-out both`,
                        }}
                        onDoubleClick={() => {
                          sound.play('ui_button_press');
                          handleRemoveDanmaku(realIndex);
                        }}
                        title="双击移除弹幕"
                      >
                        <p className={`leading-snug break-words font-data ${
                          item.isPreset ? 'text-[11px] text-white/55' : 'text-[13px] text-white/80'
                        }`}>
                          {!item.isPreset && item.score >= 7 && (
                            <span className="text-yellow-400 mr-1 text-[10px]">★{item.score}</span>
                          )}
                          <span className="text-white/55 text-[10px] mr-1">
                            {item.senderName || '观众'}:
                          </span>
                          {item.text || '...'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 底部浮动工具栏（TikTok 风格） */}
            <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-around py-2 px-3 bg-black/75 border-t border-game-border/20 backdrop-blur-md">
              <button
                onClick={() => { sound.play('ui_button_press'); setMobilePanel(mobilePanel === 'props' ? null : 'props'); setDanmakuExpanded(false); }}
                className={`touch-target flex flex-col items-center gap-0.5 px-3 py-1 rounded-md transition-all ${
                  mobilePanel === 'props' ? 'text-accent bg-accent/10 scale-110' : 'text-game-text-dim/70 active:text-accent active:scale-95'
                }`}
              >
                <span className="text-lg">🛠</span>
                <span className="font-data text-[10px]">道具</span>
              </button>
              <button
                onClick={() => { sound.play('ui_button_press'); setMobilePanel(mobilePanel === 'scenes' ? null : 'scenes'); setDanmakuExpanded(false); }}
                className={`touch-target flex flex-col items-center gap-0.5 px-3 py-1 rounded-md transition-all ${
                  mobilePanel === 'scenes' ? 'text-accent-tertiary bg-accent-tertiary/10 scale-110' : 'text-game-text-dim/70 active:text-accent-tertiary active:scale-95'
                }`}
              >
                <span className="text-lg">🎬</span>
                <span className="font-data text-[10px]">场景</span>
              </button>
              <button
                onClick={() => { sound.play('ui_button_press'); setMobilePanel(null); setDanmakuExpanded(!danmakuExpanded); }}
                className={`touch-target flex flex-col items-center gap-0.5 px-3 py-1 rounded-md transition-all ${
                  danmakuExpanded ? 'text-accent-secondary bg-accent-secondary/10 scale-110' : 'text-game-text-dim/70 active:text-accent-secondary active:scale-95'
                }`}
              >
                <span className="text-lg">💬</span>
                <span className="font-data text-[10px]">{danmakuExpanded ? '收 起' : '发弹幕'}</span>
              </button>
              <button
                onClick={() => { sound.play('ui_button_press'); onBackToMenu(); }}
                className="touch-target flex flex-col items-center gap-0.5 px-3 py-1 rounded-md transition-all text-game-text-dim/70 active:text-danger active:scale-95"
              >
                <span className="text-lg">🚪</span>
                <span className="font-data text-[10px]">返回</span>
              </button>
            </div>

            {/* 弹幕发送面板（展开时显示） */}
            {danmakuExpanded && (
              <div className="absolute bottom-14 left-0 right-0 z-25 animate-slide-up px-2" style={{ maxHeight: '44vh' }}>
                <div className="rounded-md border border-game-border/40 bg-black/85 backdrop-blur-md flex flex-col overflow-hidden h-full">
                  <DanmakuStream
                    list={danmakuList.slice(-10)}
                    onRemove={handleRemoveDanmaku}
                    onSendQuick={handleSendQuick}
                    compact
                    compactExpanded={true}
                  />
                </div>
              </div>
            )}


            {/* 道具选择底部弹出面板 */}
            {mobilePanel === 'props' && (
              <div 
                className="absolute bottom-12 left-0 right-0 z-25 bg-game-surface/95 border-t border-game-border backdrop-blur-md animate-slide-up rounded-t-xl max-h-[55%] overflow-y-auto"
                onTouchMove={handlePropTouchMove}
                onTouchEnd={handlePropTouchEnd}
              >
                <div className="sticky top-0 flex items-center justify-between px-4 py-2.5 border-b border-game-border/30 bg-game-surface z-10">
                  <span className="font-cyber text-xs text-accent tracking-wider">🛠 道具选择</span>
                  <span className="font-data text-[10px] text-game-text-dim/40">长按拖拽到画布</span>
                  <button
                    onClick={() => { sound.play('ui_button_press'); setMobilePanel(null); }}
                    className="font-cyber text-base text-game-text-dim/50 active:text-danger touch-target"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 p-3">
                  {mobileProps.map((key) => {
                    const manifest = PROP_MANIFEST[key];
                    const canAfford = points >= manifest.cost;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!canAfford}
                        onTouchStart={(e) => { if (canAfford) handlePropTouchStart(e, key); }}
                        className={`touch-target flex flex-col items-center gap-1 p-2 rounded-md text-center transition-all select-none ${
                          canAfford
                            ? 'border border-game-border/60 bg-game-bg/60 text-game-text active:border-accent active:bg-accent/10'
                            : 'border border-game-border/20 bg-game-bg/30 text-game-text-dim/30'
                        }`}
                      >
                        <span className="font-data text-[11px] leading-tight pointer-events-none">{manifest.label}</span>
                        <span className={`font-cyber text-[9px] pointer-events-none ${canAfford ? 'text-accent/80' : 'text-danger/50'}`}>
                          {manifest.cost}💰
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 场景选择底部弹出面板 */}
            {mobilePanel === 'scenes' && (
              <div className="absolute bottom-12 left-0 right-0 z-25 bg-game-surface/95 border-t border-game-border backdrop-blur-md animate-slide-up rounded-t-xl max-h-[55%] overflow-y-auto">
                <div className="sticky top-0 flex items-center justify-between px-4 py-2.5 border-b border-game-border/30 bg-game-surface z-10">
                  <span className="font-cyber text-xs text-accent-tertiary tracking-wider">🎬 场景切换</span>
                  <button
                    onClick={() => { sound.play('ui_button_press'); setMobilePanel(null); }}
                    className="font-cyber text-base text-game-text-dim/50 active:text-danger touch-target"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 p-3">
                  {SCENE_CONFIGS.map((scene) => {
                    const selected = sceneType === scene.key;
                    const isUnlocked = unlockedScenes.includes(scene.key);
                    const canAfford = isUnlocked && (selected || points >= scene.cost);
                    return (
                      <button
                        key={scene.key}
                        type="button"
                        onClick={() => { sound.play('ui_button_press'); handleMobileSceneSelect(scene.key); setMobilePanel(null); }}
                        className={`touch-target flex flex-col items-center gap-1 p-2 rounded-md transition-all ${
                          selected
                            ? 'border-2 border-purple-400 bg-purple-500/80 text-black'
                            : !isUnlocked
                              ? 'border border-game-border/20 bg-game-bg/30 text-game-text-dim/30'
                            : canAfford
                              ? 'border border-game-border/50 bg-game-bg/40 text-game-text-dim active:border-purple-300 active:text-purple-300'
                              : 'border border-game-border/20 bg-game-bg/30 text-game-text-dim/30'
                        }`}
                      >
                        <span className="font-data text-[11px]">{scene.labelCn}</span>
                        <span className={`font-cyber text-[9px] ${canAfford ? 'text-accent/80' : 'text-danger/60'}`}>
                          {!isUnlocked ? 'LOCK' : scene.cost === 0 ? 'FREE' : `${scene.cost}💰`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BOSS SC 弹窗（手机端：AI SuperChat 自动居中弹出） */}
            {bossScPopup && (
              <div className="absolute inset-0 z-40 flex items-center justify-center animate-fade-in" onClick={() => { sound.play('ui_button_press'); setBossScPopup(null); }}>
                <div className="absolute inset-0 bg-black/60" />
                <div className="relative mx-4 w-full max-w-[340px] rounded-xl overflow-hidden border-2 border-yellow-500/60 shadow-2xl shadow-yellow-500/20 animate-scale-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* SC 头部 */}
                  <div className="bg-gradient-to-r from-yellow-600 via-yellow-500 to-amber-400 px-4 py-2.5 flex items-center gap-2">
                    <span className="text-lg">⭐</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-cyber text-[11px] text-black tracking-wider">
                        {bossScPopup.senderName || '匿名观众'} 的 Super Chat
                      </p>
                      <p className="font-data text-[10px] text-black/70">
                        ¥{bossScPopup.score * 10}.00
                      </p>
                    </div>
                    <button
                      onClick={() => { sound.play('ui_button_press'); setBossScPopup(null); }}
                      className="text-black/60 hover:text-black text-base touch-target"
                    >
                      ✕
                    </button>
                  </div>
                  {/* SC 内容 */}
                  <div className="bg-game-surface px-4 py-3">
                    <p className="font-data text-sm text-white/90 leading-relaxed">
                      {bossScPopup.text || '...'}
                    </p>
                    {bossScPopup.pointsReward !== undefined && (
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-accent/80">
                        <span>💰</span>
                        <span className="font-cyber">+{bossScPopup.pointsReward} 头肯</span>
                      </div>
                    )}
                  </div>
                  {/* 自动关闭进度条 */}
                  <div className="h-[2px] bg-game-border/30">
                    <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 animate-shrink-width" />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ============================================================
             桌面布局（保持原样）
             ============================================================ */
          <>
            {/* Phaser 画布（舞台区域） + 浮层覆盖 */}
            <div className="flex-1 min-w-0 min-h-0" data-tutorial="game-canvas">
              <div className="h-full flex flex-col p-2">
                {/* 舞台标题 */}
                <div className="flex items-center justify-between mb-1 px-1 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-accent" />
                    <span className="font-cyber text-[10px] text-accent tracking-wider">
                      SESSION // {mode === 'story' ? 'STORY' : 'ENDLESS'}
                    </span>
                    <span className="status-icon hidden sm:inline-flex text-accent-tertiary" aria-hidden="true">CAM</span>
                  </div>
                  <span className="font-data text-[10px] text-game-text-dim">
                    LV{currentLevel} // {difficultyName}
                  </span>
                  {/* 关卡策略提示按钮 */}
                  {mode === 'story' && levelHint && (
                    <button
                      onClick={() => { sound.play('ui_button_press'); setShowLevelHint(true); }}
                      onMouseEnter={() => sound.play('ui_button_hover')}
                      className="font-cyber text-[9px] tracking-wider px-2 py-0.5 rounded-sm border border-game-border/50 text-game-text-dim/50 hover:border-yellow-500/30 transition-all"
                    >
                      💡 HINT
                    </button>
                  )}
                </div>

                {/* 关卡策略提示弹窗 */}
                {showLevelHint && levelHint && (
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowLevelHint(false)} />
                    <div className="absolute top-12 right-4 z-[9999] w-64 animate-fade-in">
                      <div className="bg-game-surface border border-yellow-500/30 rounded-md p-3 shadow-lg shadow-yellow-900/20">
                        <div className="flex items-start gap-2">
                          <span className="text-lg shrink-0">💡</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-cyber text-[10px] text-yellow-400 tracking-wider mb-1">关卡提示</p>
                            <p className="font-data text-[11px] text-yellow-100/80 leading-relaxed">{levelHint.hintTip}</p>
                          </div>
                          <button
                            onClick={() => { sound.play('ui_button_press'); setShowLevelHint(false); }}
                            className="text-yellow-400/50 hover:text-yellow-300 text-xs shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Phaser 画布 + 质检员浮层覆盖 */}
                <div className="stage-reticle flex-1 min-h-0 relative overflow-hidden">
                  <div className="corner-bl" aria-hidden="true" />
                  <div className="corner-br" aria-hidden="true" />
                  <div className="absolute inset-0">
                    <PhaserCanvas onPerform={handlePerform} disabled={isLoading} />
                  </div>

                  <div data-tutorial="game-perform-btn" className="absolute bottom-12 left-1/2 -translate-x-1/2 w-32 h-10 pointer-events-none" />

                  <div className="absolute bottom-0 left-0 right-0 max-h-[38%] overflow-hidden">
                    <AICommentCard />
                  </div>

                  {isLoading && reaction && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm border-t border-accent/40 animate-fade-in">
                      <div className="flex items-center gap-2 px-3 py-1.5">
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse shrink-0" />
                        <span className="font-cyber text-[10px] text-accent tracking-wider shrink-0">PROCESSING // LAUGHING_MAN</span>
                        <p className="text-sm text-accent font-data truncate">
                          {reaction}
                        </p>
                      </div>
                    </div>
                  )}

                  {phase === 'editing' && rounds.length > 0 && judgeDismissedRound < rounds.length && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 animate-fade-in">
                      <button
                        onClick={() => { sound.play('ui_button_press'); dismissJudgeCard(); }}
                        onMouseEnter={() => sound.play('ui_button_hover')}
                        className="px-6 py-3 border-2 border-accent bg-game-surface/90 backdrop-blur-md
                                   text-accent font-cyber text-xs tracking-widest
                                   hover:bg-accent hover:text-black transition-all duration-300
                                   shadow-lg shadow-accent/20 active:scale-95"
                      >
                        ◈ 质检员已出报告 — 点击继续下一回合 ◈
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 弹幕区（桌面侧边栏） */}
            <div className="flex-[0_0_30%] min-w-[280px] min-h-0 border-l border-game-border overflow-hidden" data-tutorial="game-danmaku">
              <DanmakuStream list={danmakuList} onRemove={handleRemoveDanmaku} onSendQuick={handleSendQuick} />
            </div>
          </>
        )}
      </div>

      {/* 结算弹窗 - 用 key 强制重新挂载，确保 phase=result 时组件全新渲染 */}
      {phase === 'result' && (
        <ResultModal key="result" onBackToMenu={onBackToMenu} onGoShop={onGoShop} />
      )}

      {/* 存档提示 */}
      {phase === 'result' && (
        <div className="px-4 pb-3 text-center relative z-10">
          <span className="font-data text-xs text-game-text-dim">
            [ DATA_SAVED ] 进度已自动保存至本地存储
          </span>
        </div>
      )}

      {/* 手机端拖拽幽灵道具（跟随手指） */}
      {isMobile && dragProp && (
        <div
          className="fixed pointer-events-none z-[9999]"
          style={{
            left: dragProp.x - 28,
            top: dragProp.y - 28,
            width: 56,
            height: 56,
          }}
        >
          <div className="w-full h-full rounded-lg border-2 border-accent bg-accent/20 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-accent/30 animate-pulse">
            <span className="font-data text-[11px] text-accent font-bold">
              {PROP_MANIFEST[dragProp.key]?.label ?? dragProp.key}
            </span>
          </div>
        </div>
      )}

      {/* 许愿机名字输入浮层 */}
      {wishInput && (
        <WishNameInput
          propId={wishInput.propId}
          onConfirm={handleWishConfirm}
          onCancel={handleWishCancel}
        />
      )}
    </div>
  );
}
