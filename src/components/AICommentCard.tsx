// ============================================================
// AICommentCard — 人类质检员评语卡片（舞台底部浮层，赛博朋克风格）
// v4.1: 紧凑浮层覆盖画布底部，不占用舞台空间
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { DIFFICULTY_CONFIG } from '@/store/gameStore';

const IDLE_THRESHOLD_MS = 60_000; // 1分钟不操作显示打盹
const SCROLL_PAUSE_MS = 2000; // 滚动到顶/底后的暂停时间

export function AICommentCard() {
  const rounds = useGameStore((s) => s.meter.rounds);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const judgeDismissedRound = useGameStore((s) => s.judgeDismissedRound);
  const lastRound = rounds[rounds.length - 1];

  const [isIdle, setIsIdle] = useState(false);
  const [showMotion, setShowMotion] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const reasonRef = useRef<HTMLParagraphElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;

    const resetIdle = () => {
      setIsIdle(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setIsIdle(true), IDLE_THRESHOLD_MS);
    };

    resetIdle();

    const events = ['mousedown', 'keydown', 'touchstart', 'pointerdown'];
    events.forEach((ev) => window.addEventListener(ev, resetIdle));
    return () => {
      clearTimeout(idleTimer);
      events.forEach((ev) => window.removeEventListener(ev, resetIdle));
    };
  }, []);

  // Reset motion detail when round changes
  useEffect(() => {
    setShowMotion(false);
  }, [lastRound]);

  // 判断当前是否在展示评语（活跃状态 或 等待状态但有 lastRound）
  const isShowingReason = !!(lastRound && judgeDismissedRound < rounds.length) || !!lastRound;

  // 检测评语文本宽度是否溢出容器
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      requestAnimationFrame(() => {
        setIsOverflowing(container.scrollWidth > container.clientWidth + 2);
      });
    }
  }, [lastRound?.reason, isShowingReason]);

  // 溢出时自动左右滚动播放（悬停时暂停）
  useEffect(() => {
    if (!isOverflowing || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    container.scrollLeft = 0;
    let animationId: number;
    let direction: 'right' | 'left' = 'right';
    let pauseUntil = 0;

    const step = () => {
      const now = Date.now();
      if (isHovering || now < pauseUntil) {
        animationId = requestAnimationFrame(step);
        return;
      }

      const maxScroll = container.scrollWidth - container.clientWidth;

      if (direction === 'right') {
        container.scrollLeft += 0.5;
        if (container.scrollLeft >= maxScroll - 0.5) {
          container.scrollLeft = maxScroll;
          direction = 'left';
          pauseUntil = now + SCROLL_PAUSE_MS;
        }
      } else {
        container.scrollLeft -= 0.5;
        if (container.scrollLeft <= 0.5) {
          container.scrollLeft = 0;
          direction = 'right';
          pauseUntil = now + SCROLL_PAUSE_MS;
        }
      }
      animationId = requestAnimationFrame(step);
    };

    animationId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationId);
  }, [isOverflowing, isHovering, lastRound?.reason, isShowingReason]);

  // 有最新回合且未关闭 → 紧凑质检员评语浮层
  if (lastRound && judgeDismissedRound < rounds.length) {
    const config = DIFFICULTY_CONFIG[currentLevel];

    return (
      <div className="max-h-full overflow-hidden bg-black/85 backdrop-blur-sm border-t border-accent-secondary/30 animate-fade-in">
        {/* 主行：点评可滚动，不挤压舞台布局 */}
        <div className="flex items-start gap-2 px-3 py-1.5">
          {/* AI 头像（小） */}
          <div className="w-5 h-5 border border-accent-secondary/40 bg-accent-secondary/10 flex items-center justify-center shrink-0 relative">
            <span className="font-cyber text-[8px] text-accent-secondary leading-none">AI</span>
            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-accent-secondary rounded-full animate-pulse" />
          </div>

          {/* 质检员标识 + 评语 */}
          <div className="flex-1 min-w-0 flex items-start gap-2">
            <span className="font-cyber text-[9px] text-accent-secondary tracking-wider shrink-0">
              INSPECTOR // {config?.name || 'UNKNOWN'}
            </span>
            <div
              ref={scrollContainerRef}
              className="max-h-20 flex-1 overflow-hidden pr-1"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <p
                ref={reasonRef}
                className="text-[11px] text-game-text font-data leading-relaxed whitespace-nowrap"
              >
                {lastRound.reason || '质检员沉默不语'}
              </p>
            </div>
          </div>

          {/* 右侧数据徽章 */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1">
              <span className="font-data text-[8px] text-game-text-dim">得分</span>
              <span className="font-data text-[11px] text-accent font-bold">{lastRound.funnyScore}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-data text-[8px] text-game-text-dim">增益</span>
              <span className="font-data text-[11px] text-success">+{lastRound.actualGain.toFixed(1)}</span>
            </div>
            {lastRound.decayFactor < 1 && (
              <span className="font-data text-[9px] text-game-text-dim">
                ×{lastRound.decayFactor.toFixed(2)}
              </span>
            )}
            <div className="flex items-center gap-1">
              <span className="font-data text-[10px] text-game-text-dim">#{rounds.length}</span>
            </div>
          </div>

          {/* 动作链展开按钮 */}
          {lastRound.motionSummary && (
            <button
              onClick={() => setShowMotion(!showMotion)}
              className="shrink-0 px-1.5 py-0.5 border border-accent/30 text-[8px] font-cyber text-accent
                         hover:bg-accent/20 transition-all"
              title="查看动作链详情"
            >
              {showMotion ? '▲' : '▼'} CHAIN
            </button>
          )}
        </div>

        {/* 动作链详情（可折叠） */}
        {showMotion && lastRound.motionSummary && (
          <div className="px-3 pb-2 border-t border-game-border/20">
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="font-cyber text-[8px] text-accent tracking-wider shrink-0">
                MOTION CHAIN
              </span>
              {lastRound.motionSummary.chainLabels.length > 0 && (
                <span className="font-data text-[10px] text-game-text">
                  {lastRound.motionSummary.chainLabels.join(' → ')}
                </span>
              )}
              <span className="font-data text-[9px] text-game-text-dim">
                moved {lastRound.motionSummary.movedCount} / effects {lastRound.motionSummary.effectCount}
              </span>
            </div>
            <p className="mt-1 font-data text-[10px] text-game-text-dim leading-relaxed">
              {lastRound.motionSummary.text}
            </p>
          </div>
        )}
      </div>
    );
  }

  // 没有最新回合 / 用户已关闭 → 等待状态条（保留评语滚动）
  return (
    <div className="bg-black/85 backdrop-blur-sm border-t border-accent/20">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className="w-5 h-5 border border-accent/30 bg-accent/10 flex items-center justify-center shrink-0">
          <span className="font-cyber text-[8px] text-accent leading-none">AI</span>
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-cyber text-[9px] text-game-text-dim tracking-wider shrink-0">
            INSPECTOR // {DIFFICULTY_CONFIG[currentLevel]?.name || 'UNKNOWN'}
          </span>
          {lastRound ? (
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-hidden min-w-0"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <p
                ref={reasonRef}
                className="text-[11px] text-game-text font-data leading-relaxed whitespace-nowrap"
              >
                {lastRound.reason || '质检员沉默不语'}
              </p>
            </div>
          ) : isIdle ? (
            <span className="text-[11px] text-game-text-dim font-data">[ 质检员打了个盹... ]</span>
          ) : (
            <span className="text-[11px] text-game-text-dim font-data">[ 等待表演信号输入... ]</span>
          )}
        </div>
      </div>
    </div>
  );
}
