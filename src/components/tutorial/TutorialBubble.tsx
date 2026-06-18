// ============================================================
// TutorialBubble — 引导气泡提示组件（赛博朋克风格）
// 优化：智能四向定位 + 防遮挡 + 内容滚动
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { getTutorialFrameRect } from './tutorialFrame';

interface TutorialBubbleProps {
  /** 气泡标题 */
  title: string;
  /** 气泡内容（支持多行） */
  lines: string[];
  /** 高亮目标的 data-tutorial 值，用于定位气泡 */
  targetSelector?: string;
  /** 下一步按钮文字（不传则不显示下一步按钮，用于 waitForAction 步骤） */
  nextLabel?: string;
  /** 是否显示跳过按钮 */
  showSkip?: boolean;
  /** 是否允许点击穿透到底层控件（用于等待用户操作的步骤） */
  passthrough?: boolean;
  /** 固定停靠位置，避免等待型提示挡住目标控件 */
  dock?: DockPosition;
  /** 鼠标靠近气泡时自动移动，避免挡住正在操作的位置 */
  avoidPointer?: boolean;
  /** 点击下一步 */
  onNext?: () => void;
  /** 点击跳过 */
  onSkip?: () => void;
}

type BubblePosition = 'right' | 'left' | 'bottom' | 'top' | 'center';
type DockPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

/** 气泡预估尺寸 */
const BUBBLE_W = 300;
const BUBBLE_H_EST = 220;
const GAP = 12;
const POINTER_SAFE_GAP = 28;
const BOTTOM_SAFE = 80;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function pointNearRect(
  point: { x: number; y: number },
  rect: { top: number; left: number; width: number; height: number },
  gap: number,
) {
  return (
    point.x >= rect.left - gap &&
    point.x <= rect.left + rect.width + gap &&
    point.y >= rect.top - gap &&
    point.y <= rect.top + rect.height + gap
  );
}

function rectsOverlap(
  a: { top: number; left: number; width: number; height: number },
  b: { top: number; left: number; width: number; height: number },
) {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

export function TutorialBubble({
  title,
  lines,
  targetSelector,
  nextLabel = '下一步',
  showSkip = true,
  passthrough = false,
  dock,
  avoidPointer = false,
  onNext,
  onSkip,
}: TutorialBubbleProps) {
  const [position, setPosition] = useState<{ top: number; left: number; pos: BubblePosition }>({
    top: 0,
    left: 0,
    pos: 'center',
  });
  const bubbleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);

  const calculatePosition = useCallback(() => {
    const bounds = getTutorialFrameRect();
    const bubbleW = bubbleRef.current?.offsetWidth || (dock ? 280 : BUBBLE_W);
    const bubbleH = bubbleRef.current?.offsetHeight || BUBBLE_H_EST;
    const minLeft = bounds.left + GAP;
    const maxLeft = bounds.right - bubbleW - GAP;
    const bottomSafe = BOTTOM_SAFE;
    const topSafe = bounds.top + 36;
    const maxTop = bounds.bottom - bottomSafe - bubbleH;

    const cornerCandidates = [
      { top: topSafe + GAP, left: minLeft, dock: 'top-left' },
      { top: topSafe + GAP, left: maxLeft, dock: 'top-right' },
      { top: maxTop, left: minLeft, dock: 'bottom-left' },
      { top: maxTop, left: maxLeft, dock: 'bottom-right' },
    ].map((candidate) => ({
      top: clamp(candidate.top, topSafe, maxTop),
      left: clamp(candidate.left, minLeft, maxLeft),
      dock: candidate.dock,
    }));

    const avoidPointerIfNeeded = (
      base: { top: number; left: number },
      targetRect?: { top: number; left: number; width: number; height: number },
    ) => {
      const pointer = pointerRef.current;
      const bubbleRect = { ...base, width: bubbleW, height: bubbleH };
      if (!avoidPointer || !pointer || !pointNearRect(pointer, bubbleRect, POINTER_SAFE_GAP)) {
        return base;
      }

      const best = cornerCandidates.reduce((bestCandidate, candidate) => {
        const candidateRect = { top: candidate.top, left: candidate.left, width: bubbleW, height: bubbleH };
        const dx = pointer.x - (candidate.left + bubbleW / 2);
        const dy = pointer.y - (candidate.top + bubbleH / 2);
        const targetPenalty = targetRect && rectsOverlap(candidateRect, targetRect) ? 100000 : 0;
        const currentPenalty = dock && candidate.dock === dock ? 1000 : 0;
        const score = dx * dx + dy * dy - targetPenalty - currentPenalty;
        return score > bestCandidate.score ? { candidate, score } : bestCandidate;
      }, { candidate: cornerCandidates[0], score: -Infinity });

      return { top: best.candidate.top, left: best.candidate.left };
    };

    if (dock) {
      const dockPosition = cornerCandidates.find((candidate) => candidate.dock === dock) || cornerCandidates[0];
      const targetEl = targetSelector
        ? document.querySelector(`[data-tutorial="${targetSelector}"]`) as HTMLElement | null
        : null;
      const targetRect = targetEl ? targetEl.getBoundingClientRect() : null;
      const nextPosition = avoidPointerIfNeeded(
        { top: dockPosition.top, left: dockPosition.left },
        targetRect
          ? { top: targetRect.top, left: targetRect.left, width: targetRect.width, height: targetRect.height }
          : undefined,
      );
      setPosition({ ...nextPosition, pos: 'center' });
      return;
    }

    if (!targetSelector) {
      setPosition({
        top: bounds.top + bounds.height / 2,
        left: bounds.left + bounds.width / 2,
        pos: 'center',
      });
      return;
    }
    const el = document.querySelector(`[data-tutorial="${targetSelector}"]`) as HTMLElement;
    if (!el) {
      setPosition({
        top: bounds.top + bounds.height / 2,
        left: bounds.left + bounds.width / 2,
        pos: 'center',
      });
      return;
    }
    const rect = el.getBoundingClientRect();

    // 评估四个方向的可用空间
    const spaceRight = bounds.right - rect.right - GAP;
    const spaceLeft = rect.left - bounds.left - GAP;
    const spaceBottom = bounds.bottom - rect.bottom - GAP;
    const spaceTop = rect.top - GAP - topSafe;

    let pos: BubblePosition;
    let top: number;
    let left: number;

    // 优先右侧，其次左侧，再次下方，最后上方
    if (spaceRight >= bubbleW) {
      pos = 'right';
      left = rect.right + GAP;
      top = rect.top + rect.height / 2;
    } else if (spaceLeft >= bubbleW) {
      pos = 'left';
      left = rect.left - bubbleW - GAP;
      top = rect.top + rect.height / 2;
    } else if (spaceBottom >= bubbleH) {
      pos = 'bottom';
      left = Math.max(GAP, rect.left + rect.width / 2 - bubbleW / 2);
      top = rect.bottom + GAP;
    } else if (spaceTop >= bubbleH) {
      pos = 'top';
      left = Math.max(GAP, rect.left + rect.width / 2 - bubbleW / 2);
      top = rect.top - bubbleH - GAP;
    } else {
      // 都不够，放下方并允许溢出
      pos = 'bottom';
      left = Math.max(GAP, rect.left + rect.width / 2 - bubbleW / 2);
      top = rect.bottom + GAP;
    }

    // 水平方向约束
    left = clamp(left, minLeft, maxLeft);
    // 垂直方向约束：不超出上下安全区域
    top = clamp(top, topSafe, maxTop);

    const nextPosition = avoidPointerIfNeeded(
      { top, left },
      { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    );
    if (nextPosition.top !== top || nextPosition.left !== left) {
      top = nextPosition.top;
      left = nextPosition.left;
      pos = 'center';
    }

    setPosition({ top, left, pos });
  }, [avoidPointer, dock, targetSelector]);

  useEffect(() => {
    calculatePosition();
    const timer = setInterval(calculatePosition, 500);
    window.addEventListener('resize', calculatePosition);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [calculatePosition]);

  useEffect(() => {
    if (!avoidPointer) return;

    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        calculatePosition();
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [avoidPointer, calculatePosition]);

  const isCenter = !targetSelector && !dock;
  const dockStyle: React.CSSProperties | null = dock
    ? {
        top: position.top,
        left: position.left,
        width: 280,
      }
    : null;

  return (
    <div
      ref={bubbleRef}
      className={`fixed z-[202] animate-tutorial-bubble-in ${passthrough ? 'pointer-events-none' : ''}`}
      style={
        dockStyle
          ? dockStyle
          : isCenter
          ? {
              top: position.top,
              left: position.left,
              transform: 'translate(-50%, -50%)',
            }
          : {
              top: position.top,
              left: position.left,
              width: BUBBLE_W,
            }
      }
    >
      <div className="cyber-panel p-3" style={{ background: 'var(--game-surface)' }}>
        {/* 顶部装饰条 */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-secondary to-transparent" />

        {/* 标题 */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-4 bg-accent-secondary shrink-0" />
          <h3 className="font-cyber text-[11px] text-accent-secondary tracking-wider leading-tight">{title}</h3>
        </div>

        {/* 内容（带滚动，最大高度限制） */}
        <div
          ref={contentRef}
          className="mb-3 overflow-y-auto pr-1"
          style={{ maxHeight: '160px' }}
        >
          <div className="space-y-1.5">
            {lines.map((line, i) => (
              <p key={i} className="font-data text-[13px] text-game-text leading-snug">
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* 按钮区 */}
        <div className="flex items-center gap-2">
          {onNext && nextLabel ? (
            <button
              onClick={onNext}
              className="cyber-btn cyber-btn-pink flex-1 text-[11px] py-1.5 pointer-events-auto"
            >
              ◈ {nextLabel}
            </button>
          ) : (
            <div className="flex-1" />
          )}
          {showSkip && onSkip && (
            <button
              onClick={onSkip}
              className="text-[11px] font-data text-game-text-dim hover:text-accent transition-colors whitespace-nowrap px-1 pointer-events-auto"
            >
              跳过引导
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
