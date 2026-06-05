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
  const gameRef = useRef<Phaser.Game | null>(null);
  const onPerformRef = useRef(onPerform);
  const disabledRef = useRef(disabled);

  // 同步最新 props 到 ref（避免 useEffect 重新挂载）
  onPerformRef.current = onPerform;
  disabledRef.current = disabled;

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const game = new Phaser.Game({
      parent: containerRef.current,
      type: Phaser.CANVAS,
      width: 1280,
      height: 720,
      backgroundColor: '#050508',
      render: {
        pixelArt: false,
        antialias: true,
        roundPixels: false,
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
        min: { width: 640, height: 360 },
        max: { width: 2560, height: 1440 },
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
    <div className="w-full h-full relative flex items-center justify-center bg-game-bg">
      {/* 直播舞台边框 */}
      <div className="absolute inset-0 border border-game-border pointer-events-none z-10">
        {/* 四角装饰 */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-accent" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-accent" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent" />
      </div>

      {/* REC 录制指示 */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-game-bg/80 px-2 py-1">
        <div className="w-2 h-2 bg-danger rounded-full animate-pulse" />
        <span className="font-cyber text-[10px] text-danger tracking-wider">REC</span>
      </div>

      {/* 舞台信息 */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-game-bg/80 px-2 py-1">
        <span className="font-data text-[10px] text-game-text-dim">
          STAGE // LIVE
        </span>
      </div>

      {/* Phaser 画布容器 - 固定 16:9 比例 */}
      <div
        ref={containerRef}
        className="phaser-container w-full h-full overflow-hidden crt-screen"
        style={{ aspectRatio: '16/9', maxHeight: '100%' }}
      />
    </div>
  );
}
