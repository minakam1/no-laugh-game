// ============================================================
// LiveStage — 直播主容器（赛博朋克直播间布局）
// Zustand 切片订阅 + 响应式布局 + 完整游戏循环
// 新增：表演阶段自动播放预设背景弹幕
// ============================================================

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore, DIFFICULTY_CONFIG } from '@/store/gameStore';
import { usePerform } from '@/hooks/usePerform';
import { useResponsive } from '@/hooks/useResponsive';
import { PhaserCanvas } from './PhaserCanvas';
import { PropPanel } from './PropPanel';
import { BreakdownBar } from './BreakdownBar';
import { DanmakuStream, type DanmakuItem } from './DanmakuStream';
import { AICommentCard } from './AICommentCard';
import { ResultModal } from './ResultModal';
import { ErrorBanner } from './ErrorBanner';
import { generatePresetDanmaku, generateEditingDanmaku } from '@/data/presetDanmaku';
import type { ApiConfig } from './ApiKeyInput';

interface LiveStageProps {
  apiConfig: ApiConfig;
  onBackToMenu: () => void;
  onBackToConfig: () => void;
}

/** 弹幕刷屏曲线参数
 *  基于当前回合数计算弹幕密度，回合越多弹幕越密集
 *  round 1: ~1.5秒一条
 *  round 5: ~0.5秒一条
 *  round 10+: 可能同时出现多条（爆发式）
 */
function getDanmakuInterval(round: number): number {
  // 基础间隔随回合递减，但有随机抖动
  // round 1: 1200-1800ms, round 5: 300-700ms, round 10+: 100-400ms
  const base = Math.max(120, 1800 - round * 160);
  const jitter = Math.random() * base * 0.6; // 60% 随机抖动
  return Math.floor(base * 0.4 + jitter);
}

/** 计算本轮要发射的弹幕数量（爆发机制） */
function getDanmakuBurstCount(round: number): number {
  // 低回合：基本单条，偶尔2条
  // 高回合：可能一次性刷3-5条，模拟弹幕高潮
  const roll = Math.random();
  if (round >= 8 && roll > 0.85) return Math.floor(3 + Math.random() * 3); // 8+回合：15%概率爆发3-5条
  if (round >= 5 && roll > 0.92) return Math.floor(2 + Math.random() * 2); // 5+回合：8%概率爆发2-3条
  if (roll > 0.75) return 2; // 25%概率双条
  return 1;
}

export function LiveStage({ apiConfig, onBackToMenu, onBackToConfig }: LiveStageProps) {
  const bp = useResponsive();

  // Zustand 切片订阅
  const phase = useGameStore((s) => s.phase);
  const meterValue = useGameStore((s) => s.meter.value);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const currentRound = useGameStore((s) => s.currentRound);
  const maxRounds = useGameStore((s) => s.maxRounds);
  const mode = useGameStore((s) => s.mode);
  const rounds = useGameStore((s) => s.meter.rounds);
  const judgeDismissedRound = useGameStore((s) => s.judgeDismissedRound);
  const dismissJudgeCard = useGameStore((s) => s.dismissJudgeCard);
  const forceSettle = useGameStore((s) => s.forceSettle);
  const difficultyName = DIFFICULTY_CONFIG[currentLevel]?.name || 'UNKNOWN';

  // usePerform hook
  const { reaction, isLoading, error, handlePerform, dismissError } = usePerform(apiConfig);

  // 预设弹幕状态
  const [presetDanmaku, setPresetDanmaku] = useState<DanmakuItem[]>([]);
  const presetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presetIdRef = useRef(0);
  const phaseStartTimeRef = useRef<number>(0);

  /** 发射一批弹幕（支持爆发） */
  const fireDanmakuBurst = useCallback((generator: () => string, count: number) => {
    for (let i = 0; i < count; i++) {
      // 爆发时稍微错开时间，避免完全同步
      const delay = i === 0 ? 0 : Math.random() * 150;
      setTimeout(() => {
        const text = generator();
        presetIdRef.current += 1;
        setPresetDanmaku((prev) => [
          ...prev,
          {
            text,
            score: 0,
            round: presetIdRef.current,
            isPreset: true,
          },
        ]);
      }, delay);
    }
  }, []);

  /** 自动播放预设弹幕（editing 和 performing 阶段都播放） */
  useEffect(() => {
    // 清除之前的定时器
    if (presetTimerRef.current) {
      clearTimeout(presetTimerRef.current);
      presetTimerRef.current = null;
    }
    phaseStartTimeRef.current = Date.now();

    if (phase === 'performing') {
      // 表演阶段：基于回合数的动态密度
      const scheduleNext = () => {
        const interval = getDanmakuInterval(currentRound);
        const burstCount = getDanmakuBurstCount(currentRound);
        presetTimerRef.current = setTimeout(() => {
          fireDanmakuBurst(generatePresetDanmaku, burstCount);
          scheduleNext();
        }, interval);
      };
      scheduleNext();
    } else if (phase === 'editing') {
      // 编辑阶段：固定较慢频率（观众等待状态）
      const scheduleNext = () => {
        // 编辑阶段：1.5-3秒一条，偶尔双条
        const interval = 1500 + Math.random() * 1500;
        const count = Math.random() > 0.85 ? 2 : 1;
        presetTimerRef.current = setTimeout(() => {
          fireDanmakuBurst(generateEditingDanmaku, count);
          scheduleNext();
        }, interval);
      };
      scheduleNext();
    } else {
      // 其他阶段（judging/result）：暂停预设弹幕但不删除已有内容
      // 不清理 presetDanmaku，保持聊天记录完整
    }

    return () => {
      if (presetTimerRef.current) {
        clearTimeout(presetTimerRef.current);
      }
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
      for (let i = prevRoundsLenRef.current; i < rounds.length; i++) {
        newItems.push({
          text: rounds[i].reaction,
          score: rounds[i].funnyScore,
          round: i + 1,
        });
      }
      allDanmakuRef.current = [...allDanmakuRef.current, ...newItems];
    }
    prevRoundsLenRef.current = rounds.length;
  }, [rounds]);

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

  /** 双击移除弹幕 */
  const handleRemoveDanmaku = useCallback((index: number) => {
    allDanmakuRef.current = allDanmakuRef.current.filter((_, i) => i !== index);
    setListVersion((v) => v + 1);
  }, []);

  const isMobile = bp === 'mobile';

  // 模拟在线人数（与绷不住值正相关 + 大幅随机波动，允许减少）
  // meterValue 0→base 8000, meterValue 100→base 35000
  const baseViewers = 8000 + meterValue * 270;
  const [viewerCount, setViewerCount] = useState(() =>
    Math.floor(baseViewers + (Math.random() - 0.5) * 400)
  );
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

  return (
    <div className="h-full flex flex-col bg-game-bg relative">
      {/* 扫描线背景 */}
      <div className="absolute inset-0 scanlines pointer-events-none z-50" />

      {/* === 顶栏：直播间标题栏（OBS风格）=== */}
      <div className="shrink-0 border-b border-game-border bg-game-surface/80 backdrop-blur-sm relative z-10">
        {/* 顶部霓虹条 */}
        <div className="h-[2px] bg-gradient-to-r from-accent via-accent-secondary to-accent-tertiary" />

        <div className="flex items-center gap-2 px-3 py-1.5">
          {/* 左侧：直播状态 */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="live-badge">LIVE</span>
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              <span className="font-data text-xs text-viewer-count">
                {viewerCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 中间：绷不住值进度条 */}
          <div className="flex-1 min-w-0">
            <BreakdownBar
              value={meterValue}
              level={currentLevel}
              round={currentRound}
              maxRounds={maxRounds}
              mode={mode}
              onForceSettle={forceSettle}
            />
          </div>

          {/* 右侧：控制按钮 */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onBackToMenu}
              title="返回直播间主页"
              className="px-2 py-1 border border-game-border text-[10px] font-cyber text-game-text-dim
                         hover:border-accent hover:text-accent transition-all tracking-wider"
            >
              EXIT
            </button>
            <button
              onClick={onBackToConfig}
              title="编辑信号配置"
              className="px-2 py-1 border border-game-border text-[10px] font-cyber text-game-text-dim
                         hover:border-accent-secondary hover:text-accent-secondary transition-all tracking-wider"
            >
              SIGNAL
            </button>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && <ErrorBanner message={error} onDismiss={dismissError} />}

      {/* === 主体区域：响应式布局 === */}
      <div
        className={`flex-1 flex overflow-hidden relative z-10 ${
          isMobile ? 'flex-col' : 'flex-row'
        }`}
      >
        {/* 道具面板（左侧，画布外） */}
        {!isMobile && <PropPanel />}

        {/* Phaser 画布（舞台区域） */}
        <div className={isMobile ? 'flex-[0_0_55%]' : 'flex-1'}>
          <div className="h-full flex flex-col p-2">
            {/* 舞台标题 */}
            <div className="flex items-center justify-between mb-1 px-1">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-accent" />
                <span className="font-cyber text-[10px] text-accent tracking-wider">
                  STAGE // {mode === 'story' ? 'STORY' : 'ENDLESS'}
                </span>
              </div>
              <span className="font-data text-[10px] text-game-text-dim">
                LV{currentLevel} // {difficultyName}
              </span>
            </div>
            {/* Phaser 画布容器 */}
            <div className="flex-1 min-h-0">
              <PhaserCanvas onPerform={handlePerform} disabled={isLoading} />
            </div>
          </div>
        </div>

        {/* 弹幕区（直播聊天面板） */}
        <div
          className={`border-game-border ${
            isMobile
              ? 'flex-1 border-t'
              : 'flex-[0_0_30%] border-l'
          }`}
        >
          <DanmakuStream list={danmakuList} onRemove={handleRemoveDanmaku} />
        </div>
      </div>

      {/* === 底栏：裁判解说条 === */}
      <div className="shrink-0 relative z-10">
        <AICommentCard />
      </div>

      {/* 当前反应（表演中） */}
      {isLoading && reaction && (
        <div className="px-4 py-2 bg-accent/10 border-t border-accent/30 animate-fade-in relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            <span className="font-cyber text-[10px] text-accent tracking-wider">PROCESSING</span>
            <p className="text-sm text-accent font-medium font-data">
              {reaction}
            </p>
          </div>
        </div>
      )}

      {/* 裁判打分提示条（judging 后显示，点击关闭） */}
      {phase === 'editing' && rounds.length > 0 && judgeDismissedRound < rounds.length && (
        <div className="px-4 pb-3 flex justify-center relative z-10 animate-fade-in">
          <button
            onClick={dismissJudgeCard}
            className="px-4 py-1.5 border border-accent/50 bg-accent/10 text-accent font-cyber text-[10px]
                       hover:bg-accent/20 transition-all tracking-wider"
          >
            ◈ 裁判已打分 — 点击继续下一回合
          </button>
        </div>
      )}

      {/* 结算弹窗 */}
      <ResultModal onBackToMenu={onBackToMenu} />

      {/* 存档提示 */}
      {phase === 'result' && (
        <div className="px-4 pb-3 text-center relative z-10">
          <span className="font-data text-xs text-game-text-dim">
            [ DATA_SAVED ] 进度已自动保存至本地存储
          </span>
        </div>
      )}
    </div>
  );
}
