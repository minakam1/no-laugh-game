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
    return 150 + Math.random() * 600; // 150-750ms，密集催促
  }
  // 1.0-5.0秒，大幅随机，模拟真实直播间等待状态
  const base = 1200;
  const jitter = Math.random() * 3800;
  // 8%概率极快（多人同时催促），8%概率极慢（安静等待）
  if (Math.random() < 0.08) return 200 + Math.random() * 250; // 极快
  if (Math.random() < 0.08) return 3500 + Math.random() * 2500; // 极慢
  return base + jitter;
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
  // 玩家放置道具时触发弹幕加速（模拟观众看到动作后的反应）
  // ============================================================
  useEffect(() => {
    const unsub = eventBus.on('prop-placed', () => {
      triggerDanmakuBoost(3000); // 放置后3秒弹幕加速
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
              { text, score: 0, round: presetIdRef.current, isPreset: true },
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
    return allDanmakuRef.current;
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
  }, [currentRound]);

  const isMobile = bp === 'mobile';

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

      {/* === 顶栏：直播间标题栏（OBS风格）=== */}
      <div className="shrink-0 border-b border-game-border bg-game-surface/80 backdrop-blur-sm relative z-10">
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

        {isMobile && (
          <div className="shrink-0 border-b border-game-border bg-game-surface/80">
            <div className="flex gap-2 overflow-x-auto px-2 py-2">
              {mobileProps.map((key) => {
                const manifest = PROP_MANIFEST[key];
                const canAfford = points >= manifest.cost;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!canAfford}
                    onClick={() => { sound.play('ui_button_press'); handleMobilePlaceProp(key); }}
                    className={`shrink-0 w-[74px] border px-2 py-1 text-center transition-all ${
                      canAfford
                        ? 'border-game-border/60 bg-game-bg/60 text-game-text hover:border-accent hover:text-accent'
                        : 'border-game-border/20 bg-game-bg/30 text-game-text-dim/40'
                    }`}
                  >
                    <span className="block font-data text-xs truncate">{manifest.label}</span>
                    <span className="block font-cyber text-[10px] text-accent/80">{manifest.cost}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 overflow-x-auto px-2 pb-2">
              {SCENE_CONFIGS.map((scene) => {
                const selected = sceneType === scene.key;
                const isUnlocked = unlockedScenes.includes(scene.key);
                const canAfford = isUnlocked && (selected || points >= scene.cost);
                return (
                  <button
                    key={scene.key}
                    type="button"
                    onClick={() => { sound.play('ui_button_press'); handleMobileSceneSelect(scene.key); }}
                    className={`shrink-0 border px-3 py-1 font-data text-xs transition-all ${
                      selected
                        ? 'border-purple-300 bg-purple-500 text-black'
                        : !isUnlocked
                          ? 'border-game-border/20 bg-game-bg/30 text-game-text-dim/30 cursor-not-allowed'
                        : canAfford
                          ? 'border-game-border/50 bg-game-bg/40 text-game-text-dim hover:border-purple-300 hover:text-purple-300'
                          : 'border-game-border/20 bg-game-bg/30 text-game-text-dim/30 cursor-not-allowed'
                    }`}
                  >
                    <span className="block">{scene.labelCn}</span>
                    <span className={`block text-[10px] ${canAfford ? 'text-accent/80' : 'text-danger/60'}`}>
                      {!isUnlocked ? 'LOCK' : scene.cost === 0 ? 'FREE' : `${scene.cost}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Phaser 画布（舞台区域） + 浮层覆盖 */}
        <div className={isMobile ? 'flex-[0_0_46%] min-h-[260px]' : 'flex-1 min-w-0 min-h-0'} data-tutorial="game-canvas">
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
              {/* 关卡策略提示按钮 — 点击弹出独立弹窗 */}
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

            {/* 关卡策略提示弹窗 — 不占用布局空间 */}
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
              {/* 黄色四角装饰（底部两个角） */}
              <div className="corner-bl" aria-hidden="true" />
              <div className="corner-br" aria-hidden="true" />
              <div className="absolute inset-0">
                <PhaserCanvas onPerform={handlePerform} disabled={isLoading} />
              </div>

              {/* 引导标记：开始表演按钮区域（画布底部） */}
              <div data-tutorial="game-perform-btn" className="absolute bottom-12 left-1/2 -translate-x-1/2 w-32 h-10 pointer-events-none" />

              {/* 等待状态质检员条（静止覆盖底部） */}
              <div className="absolute bottom-0 left-0 right-0 max-h-[38%] overflow-hidden">
                <AICommentCard />
              </div>

              {/* 当前反应（表演中 - 覆盖底部，质检员条上方） */}
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

              {/* 继续下一回合 — 舞台中央浮层 */}
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

        {/* 弹幕区（直播聊天面板）- 延长至满高度 */}
        <div
          className={`border-game-border overflow-hidden ${
            isMobile
              ? 'flex-1 min-h-0 border-t'
              : 'flex-[0_0_30%] min-w-[280px] min-h-0 border-l'
          }`}
          data-tutorial="game-danmaku"
        >
          <DanmakuStream list={danmakuList} onRemove={handleRemoveDanmaku} onSendQuick={handleSendQuick} />
        </div>
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
