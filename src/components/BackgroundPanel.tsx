// ============================================================
// BackgroundPanel — 背景选择栏（道具栏与画布之间，竖排）
// ============================================================

import { useState } from 'react';
import { eventBus } from '@/phaser/bridges/PhaserEventBus';

const PAID_BACKGROUND_COST = 0;

const BACKGROUNDS = [
  {
    key: 'grid-bg',
    label: 'GRID',
    cost: 0,
    preview: 'linear-gradient(135deg, #080808 0 45%, #e7ff2f 45% 50%, #080808 50% 100%)',
  },
  {
    key: 'bg-dark',
    label: 'DARK',
    cost: PAID_BACKGROUND_COST,
    preview: '#080810',
  },
  {
    key: 'bg-studio',
    label: 'STUDIO',
    cost: PAID_BACKGROUND_COST,
    preview: 'linear-gradient(90deg, #050510, #2a2a5e, #050510)',
  },
  {
    key: 'bg-neon',
    label: 'NEON',
    cost: PAID_BACKGROUND_COST,
    preview: 'repeating-linear-gradient(90deg, #050508 0 10px, #00e5ff 10px 11px, #050508 11px 22px)',
  },
] as const;

type BackgroundKey = (typeof BACKGROUNDS)[number]['key'];

export function BackgroundPanel() {
  const [selectedBg, setSelectedBg] = useState<BackgroundKey>('grid-bg');

  const handleSelect = (key: BackgroundKey) => {
    if (key === selectedBg) return;
    setSelectedBg(key);
    eventBus.emit('request-set-background', { key });
  };

  return (
    <div
      className="shrink-0 flex flex-col border-r border-game-border bg-game-surface/80 backdrop-blur-sm items-center"
      style={{ width: 72 }}
    >
      <div className="shrink-0 px-1.5 py-2 border-b border-game-border flex items-center justify-center w-full">
        <span className="font-cyber text-[10px] text-accent tracking-wider">BG</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-2 px-1.5 space-y-1.5 w-full">
        {BACKGROUNDS.map((bg) => {
          const isSelected = selectedBg === bg.key;

          return (
            <button
              key={bg.key}
              type="button"
              onClick={() => handleSelect(bg.key)}
              title={`${bg.label}`}
              className={`w-full border-2 p-1 text-center transition-all select-none rounded-none
                         ${isSelected
                  ? 'border-accent bg-accent text-black shadow-[2px_2px_0_#000]'
                  : 'border-game-border/40 bg-game-bg/40 text-game-text-dim hover:border-accent-tertiary hover:text-accent-tertiary'
                }`}
            >
              <div
                className="h-7 w-full border border-black/70"
                style={{ background: bg.preview }}
              />
              <div className="mt-0.5 text-center">
                <span className="font-data text-[8px] leading-none">
                  {bg.label}
                </span>
              </div>
              <div className="text-center">
                <span className="font-data text-[7px] leading-none font-bold">
                  {bg.cost === 0 ? 'FREE' : `${bg.cost}◈`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="shrink-0 min-h-[32px] px-1.5 py-1.5 border-t border-game-border text-center">
        <span className="font-data text-[7px] leading-tight text-game-text-dim/50 block">
          FREE
        </span>
      </div>
    </div>
  );
}
