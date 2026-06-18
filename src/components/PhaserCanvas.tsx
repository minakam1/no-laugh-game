// ============================================================
// PhaserCanvas — Phaser 挂载容器（赛博朋克直播舞台风格 + 固定比例）
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import Phaser from 'phaser';
import { BootScene } from '@/phaser/scenes/BootScene';
import { EditorScene } from '@/phaser/scenes/EditorScene';
import { eventBus } from '@/phaser/bridges/PhaserEventBus';
import type { PerformRequestedData } from '@/phaser/bridges/PhaserEventBus';
import type { PropKey } from '@/phaser/assets/manifest';

interface PhaserCanvasProps {
  onPerform: (data: PerformRequestedData) => Promise<void>;
  disabled: boolean;
}

/** 安全边距，防止画布贴边 */
const SAFE_PADDING = 12;
/** 尺寸变化阈值：变化小于此像素数时忽略更新，防止抖动 */
const SIZE_STABILITY_THRESHOLD = 10;
/** 尺寸稳定延迟：连续稳定 N 帧后才应用新尺寸，防止布局切换时的短暂抖动 */
const SIZE_STABLE_DELAY_MS = 400;

/**
 * 根据父容器实际可用宽高，计算 4:3 比例的 Phaser 画布尺寸。
 * 返回的尺寸不超过父容器（扣除安全边距），并维持 4:3 比例。
 */
function calcCanvasSize(parentW: number, parentH: number): { w: number; h: number } {
  const availW = Math.max(160, parentW - SAFE_PADDING * 2);
  const availH = Math.max(120, parentH - SAFE_PADDING * 2);

  const ratioW = availW / 4;
  const ratioH = availH / 3;

  if (ratioW <= ratioH) {
    // 宽度受限
    const w = Math.floor(availW);
    const h = Math.floor(w * 0.75);
    return { w, h };
  } else {
    // 高度受限
    const h = Math.floor(availH);
    const w = Math.floor(h * (4 / 3));
    return { w, h };
  }
}

export function PhaserCanvas({ onPerform, disabled }: PhaserCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const onPerformRef = useRef(onPerform);
  const disabledRef = useRef(disabled);

  // 动态画布尺寸（CSS px，逻辑分辨率保持 1280x960 不变）
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);

  // 同步最新 props 到 ref（避免 useEffect 重新挂载）
  onPerformRef.current = onPerform;
  disabledRef.current = disabled;

  // 根据父容器计算 4:3 画布尺寸（带稳定性防抖 + 延迟确认）
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let lastSize: { w: number; h: number } | null = null;
    let stableTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingSize: { w: number; h: number } | null = null;

    const applySize = (newSize: { w: number; h: number }) => {
      lastSize = newSize;
      pendingSize = null;
      setCanvasSize(newSize);
    };

    const updateSize = () => {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const newSize = calcCanvasSize(rect.width, rect.height);
        // 只有当尺寸变化超过阈值时才考虑更新
        if (
          !lastSize ||
          Math.abs(newSize.w - lastSize.w) >= SIZE_STABILITY_THRESHOLD ||
          Math.abs(newSize.h - lastSize.h) >= SIZE_STABILITY_THRESHOLD
        ) {
          // 清除之前的稳定计时器，重新开始计时
          if (stableTimer) clearTimeout(stableTimer);
          pendingSize = newSize;
          stableTimer = setTimeout(() => {
            if (pendingSize) {
              applySize(pendingSize);
            }
            stableTimer = null;
          }, SIZE_STABLE_DELAY_MS);
        } else {
          // 尺寸回退到接近原始值，取消待应用的更新
          if (stableTimer && pendingSize) {
            clearTimeout(stableTimer);
            stableTimer = null;
            pendingSize = null;
          }
        }
      }
    };

    updateSize();
    const ro = new ResizeObserver(() => {
      // 用 requestAnimationFrame 防抖，避免同一帧内多次触发
      requestAnimationFrame(updateSize);
    });
    ro.observe(wrapper);
    return () => {
      ro.disconnect();
      if (stableTimer) clearTimeout(stableTimer);
    };
  }, []);

  // 监听画布尺寸变化，同步边框覆盖层位置（持续轮询确保动画期间也不脱节）
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!wrapper || !overlay || !container) return;

    const syncOverlay = () => {
      const canvas = container.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      // 使用逻辑像素（CSS pixels）对齐
      overlay.style.left = `${Math.round(rect.left - wrapperRect.left)}px`;
      overlay.style.top = `${Math.round(rect.top - wrapperRect.top)}px`;
      overlay.style.width = `${Math.round(rect.width)}px`;
      overlay.style.height = `${Math.round(rect.height)}px`;
    };

    // ResizeObserver 监听容器尺寸变化
    const ro = new ResizeObserver(syncOverlay);
    ro.observe(wrapper);
    ro.observe(container);

    // 持续轮询同步（低频，200ms），确保在 Phaser 内部缩放动画期间也不脱节
    const interval = setInterval(syncOverlay, 200);

    return () => {
      ro.disconnect();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const game = new Phaser.Game({
      parent: containerRef.current,
      type: Phaser.AUTO,
      width: 1280,
      height: 960,
      backgroundColor: '#050508',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      render: {
        pixelArt: false,
        antialias: true,
        roundPixels: false,
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 960,
        min: { width: 160, height: 120 },
        max: { width: 2560, height: 1920 },
      },
      scene: [BootScene, EditorScene],
    });

    gameRef.current = game;
    (window as any).__phaserGame = game;

    const handlePerformRequested = (data: unknown) => {
      const performData = data as PerformRequestedData;
      if (!disabledRef.current) {
        onPerformRef.current(performData);
      }
    };

    const unsub = eventBus.on('perform-requested', handlePerformRequested);

    return () => {
      unsub();
      eventBus.clear();
      game.destroy(true);
      gameRef.current = null;
    };
  }, []); // 空依赖：Phaser Game 只创建一次

  /** 处理从 React 面板拖拽道具到画布 */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const propKey = e.dataTransfer.getData('text/plain') as PropKey;
    if (!propKey) return;

    const canvas = containerRef.current?.querySelector('canvas');
    if (!canvas || !wrapperRef.current) return;

    // 获取 canvas 在页面中的位置和尺寸
    const canvasRect = canvas.getBoundingClientRect();
    // 计算相对坐标（相对于 canvas 左上角）
    const relX = e.clientX - canvasRect.left;
    const relY = e.clientY - canvasRect.top;
    // 转换为 Phaser 世界坐标（canvas 实际像素 → 世界坐标）
    const scaleX = 1280 / canvasRect.width;
    const scaleY = 960 / canvasRect.height;
    const worldX = Math.round(relX * scaleX);
    const worldY = Math.round(relY * scaleY);

    eventBus.emit('request-place-prop', { key: propKey, x: worldX, y: worldY });
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full relative flex items-center justify-center bg-game-bg overflow-hidden"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Phaser 画布容器 - 4:3 比例，根据父容器动态计算尺寸 + 安全边距 */}
      <div
        ref={containerRef}
        className="phaser-container overflow-hidden crt-screen shrink-0"
        style={{
          width: canvasSize ? `${canvasSize.w}px` : '100%',
          height: canvasSize ? `${canvasSize.h}px` : '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          position: 'relative',
        }}
      />

      {/* 直播舞台边框 - 精确跟随画布尺寸 */}
      <div
        ref={overlayRef}
        className="absolute border border-game-border pointer-events-none z-10"
        style={{ left: 0, top: 0, width: 0, height: 0 }}
      >
        {/* 四角装饰 */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-accent" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-accent" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent" />

        {/* REC 录制指示 */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-game-bg/80 px-2 py-1">
          <div className="w-2 h-2 bg-danger rounded-full animate-pulse" />
          <span className="font-cyber text-[10px] text-danger tracking-wider">REC</span>
        </div>

        {/* 舞台信息 */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-game-bg/80 px-2 py-1">
          <span className="font-data text-[10px] text-game-text-dim">
            STAGE // LIVE
          </span>
        </div>
      </div>
    </div>
  );
}
