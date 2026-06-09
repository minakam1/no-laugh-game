// ============================================================
// PhaserCanvas — Phaser 挂载容器（赛博朋克直播舞台风格 + 固定比例）
// ============================================================

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { BootScene } from '@/phaser/scenes/BootScene';
import { EditorScene } from '@/phaser/scenes/EditorScene';
import { eventBus } from '@/phaser/bridges/PhaserEventBus';
import type { PerformRequestedData } from '@/phaser/bridges/PhaserEventBus';

interface PhaserCanvasProps {
  onPerform: (data: PerformRequestedData) => Promise<void>;
  disabled: boolean;
}

export function PhaserCanvas({ onPerform, disabled }: PhaserCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const onPerformRef = useRef(onPerform);
  const disabledRef = useRef(disabled);

  // 同步最新 props 到 ref（避免 useEffect 重新挂载）
  onPerformRef.current = onPerform;
  disabledRef.current = disabled;

  // 监听画布尺寸变化，同步边框覆盖层位置
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

    const ro = new ResizeObserver(syncOverlay);
    ro.observe(wrapper);
    ro.observe(container);

    // Phaser canvas 创建有延迟，轮询一下
    const interval = setInterval(syncOverlay, 100);
    setTimeout(() => clearInterval(interval), 2000);

    return () => {
      ro.disconnect();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const game = new Phaser.Game({
      parent: containerRef.current,
      type: Phaser.CANVAS,
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
        min: { width: 640, height: 480 },
        max: { width: 2560, height: 1920 },
      },
      scene: [BootScene, EditorScene],
    });

    gameRef.current = game;

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

  return (
    <div ref={wrapperRef} className="w-full h-full relative flex items-center justify-center bg-game-bg overflow-hidden">
      {/* Phaser 画布容器 - 固定 4:3 比例，限制最大尺寸 */}
      <div
        ref={containerRef}
        className="phaser-container overflow-hidden crt-screen"
        style={{
          aspectRatio: '4/3',
          maxWidth: '100%',
          maxHeight: '100%',
          width: 'auto',
          height: 'auto',
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
