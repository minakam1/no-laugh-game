// ============================================================
// AchievementPopup — 成就解锁弹窗（直接监听 store，不依赖 eventBus）
// 渲染在 monitor-screen-content 内部，不会被边框遮挡
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAchievementStore } from '@/store/achievementStore';
import { ACHIEVEMENTS, type AchievementId } from '@/data/achievements';
import { getSoundManager } from '@/audio/SoundManager';

export function AchievementPopup() {
  const unlocked = useAchievementStore((s) => s.unlocked);
  const restoring = useAchievementStore((s) => s._restoring);
  const prevSizeRef = useRef(unlocked.size);
  const [current, setCurrent] = useState<AchievementId | null>(null);
  const [visible, setVisible] = useState(false);
  const queueRef = useRef<AchievementId[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sound = useRef(getSoundManager()).current;

  // 每次渲染都更新挂载点（确保 .monitor-screen-content 出现后能捕获到）
  const mountEl = document.querySelector('.monitor-screen-content') as HTMLElement | null;

  const showNext = useCallback(() => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const id = queueRef.current.shift();
      if (id) {
        setCurrent(id);
        requestAnimationFrame(() => setVisible(true));
      } else {
        setCurrent(null);
      }
    }, 400);
  }, []);

  // 监听 store 变化 → 加入队列
  useEffect(() => {
    // 从存档恢复成就时，跳过弹窗动画，只同步基准值
    if (restoring) {
      prevSizeRef.current = unlocked.size;
      return;
    }
    if (unlocked.size > prevSizeRef.current) {
      const prev = prevSizeRef.current;
      const allIds = Array.from(unlocked);
      const newIds = allIds.slice(prev);
      prevSizeRef.current = unlocked.size;

      for (const id of newIds) {
        queueRef.current.push(id);
        if (!current) {
          const next = queueRef.current.shift();
          if (next) {
            setCurrent(next);
            requestAnimationFrame(() => setVisible(true));
          }
        }
      }
    }
  }, [unlocked, restoring, current]);

  // 自动消失 + 音效
  useEffect(() => {
    if (!current) return;
    sound.play('perform_start');
    const timer = setTimeout(showNext, 3500);
    return () => clearTimeout(timer);
  }, [current, sound, showNext]);

  if (!current) return null;
  const ach = ACHIEVEMENTS[current];
  if (!ach) return null;

  const target = mountEl || document.body;

  return createPortal(
    <div
      className={`absolute top-4 right-4 z-[99999] transition-all duration-500 ease-out pointer-events-none ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className="relative w-72 overflow-hidden rounded-md animate-super-chat-enter">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-amber-400/15 to-yellow-500/10 rounded-md" />
        <div className="absolute inset-0 rounded-md border border-yellow-500/40" />
        <div className="relative px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{ach.icon}</span>
            <span className="font-cyber text-[10px] text-yellow-400 tracking-[0.15em]">
              ACHIEVEMENT UNLOCKED
            </span>
          </div>
          <h3 className="font-cyber text-[16px] text-yellow-300 font-bold mb-1 tracking-wider">
            {ach.title}
          </h3>
          <p className="font-data text-[11px] text-yellow-200/70 leading-relaxed">
            {ach.desc}
          </p>
          <div className="mt-2 h-px bg-gradient-to-r from-yellow-500/40 via-yellow-400/60 to-yellow-500/0" />
        </div>
        <div className="absolute inset-0 rounded-md animate-achievement-flash pointer-events-none" />
      </div>
    </div>,
    target,
  );
}
