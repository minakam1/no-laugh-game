import { useEffect, useState } from 'react';

export interface TutorialFrameRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  rightInset: number;
  bottomInset: number;
}

function viewportFallback(): TutorialFrameRect {
  const width = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const height = typeof window === 'undefined' ? 720 : window.innerHeight;

  return {
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    rightInset: 0,
    bottomInset: 0,
  };
}

export function getTutorialFrameRect(): TutorialFrameRect {
  if (typeof window === 'undefined') return viewportFallback();

  const el = document.querySelector('.monitor-crt-edge') as HTMLElement | null;
  if (!el) return viewportFallback();

  const rect = el.getBoundingClientRect();
  const inset = 8;
  const top = rect.top + inset;
  const left = rect.left + inset;
  const right = rect.right - inset;
  const bottom = rect.bottom - inset;

  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    rightInset: window.innerWidth - right,
    bottomInset: window.innerHeight - bottom,
  };
}

export function useTutorialFrameRect() {
  const [rect, setRect] = useState<TutorialFrameRect>(() => getTutorialFrameRect());

  useEffect(() => {
    const update = () => setRect(getTutorialFrameRect());
    update();

    const timer = window.setInterval(update, 500);
    window.addEventListener('resize', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', update);
    };
  }, []);

  return rect;
}
