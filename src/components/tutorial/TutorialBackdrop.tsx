// ============================================================
// TutorialBackdrop — 引导高亮遮罩层（聚光灯效果）
// ============================================================

import { useEffect, useState, useLayoutEffect, useCallback, useRef } from 'react';
import { useTutorialFrameRect } from './tutorialFrame';

interface TutorialBackdropProps {
  /** 高亮目标元素的 data-tutorial 值 */
  targetSelector?: string;
  /** 是否显示遮罩 */
  visible: boolean;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TutorialBackdrop({ targetSelector, visible }: TutorialBackdropProps) {
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const rafRef = useRef<number>(0);
  const frameRect = useTutorialFrameRect();

  const updateSpotlight = useCallback(() => {
    if (!targetSelector) {
      setSpotlight(null);
      return;
    }
    const el = document.querySelector(`[data-tutorial="${targetSelector}"]`) as HTMLElement;
    if (!el) {
      setSpotlight(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setSpotlight({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [targetSelector]);

  useLayoutEffect(() => {
    updateSpotlight();
  }, [updateSpotlight, visible]);

  useEffect(() => {
    if (!visible || !targetSelector) return;

    const observer = new MutationObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateSpotlight);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateSpotlight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [visible, targetSelector, updateSpotlight]);

  if (!visible) return null;

  // 没有高亮目标时，全屏遮罩
  if (!spotlight) {
    return (
      <div
        className="fixed z-[200] bg-black/60 backdrop-blur-[2px] animate-tutorial-fade-in pointer-events-none"
        style={{
          top: frameRect.top,
          left: frameRect.left,
          width: frameRect.width,
          height: frameRect.height,
          transition: 'opacity 0.3s',
        }}
      />
    );
  }

  // 有高亮目标时，用四块遮罩限制在显示器屏幕内
  const padding = 8;
  const highlightTop = Math.max(frameRect.top, spotlight.top - padding);
  const highlightLeft = Math.max(frameRect.left, spotlight.left - padding);
  const highlightRight = Math.min(frameRect.right, spotlight.left + spotlight.width + padding);
  const highlightBottom = Math.min(frameRect.bottom, spotlight.top + spotlight.height + padding);
  const highlightWidth = Math.max(0, highlightRight - highlightLeft);
  const highlightHeight = Math.max(0, highlightBottom - highlightTop);
  const maskStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 200,
    pointerEvents: 'none',
    background: 'rgba(0,0,0,0.65)',
  };
  const highlightStyle: React.CSSProperties = {
    position: 'fixed',
    top: highlightTop,
    left: highlightLeft,
    width: highlightWidth,
    height: highlightHeight,
    zIndex: 201,
    pointerEvents: 'none',
    border: `2px solid var(--accent)`,
    borderRadius: 2,
    transition: 'all 0.3s ease',
  };

  return (
    <>
      <div
        style={{
          ...maskStyle,
          top: frameRect.top,
          left: frameRect.left,
          width: frameRect.width,
          height: Math.max(0, highlightTop - frameRect.top),
        }}
      />
      <div
        style={{
          ...maskStyle,
          top: highlightBottom,
          left: frameRect.left,
          width: frameRect.width,
          height: Math.max(0, frameRect.bottom - highlightBottom),
        }}
      />
      <div
        style={{
          ...maskStyle,
          top: highlightTop,
          left: frameRect.left,
          width: Math.max(0, highlightLeft - frameRect.left),
          height: highlightHeight,
        }}
      />
      <div
        style={{
          ...maskStyle,
          top: highlightTop,
          left: highlightRight,
          width: Math.max(0, frameRect.right - highlightRight),
          height: highlightHeight,
        }}
      />
      <div style={highlightStyle} className="animate-tutorial-spotlight-pulse" />
    </>
  );
}
