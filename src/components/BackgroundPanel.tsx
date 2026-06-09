// ============================================================
// BackgroundPanel — 背景选择栏（道具栏与画布之间）
// ============================================================

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { eventBus } from '@/phaser/bridges/PhaserEventBus';

const PAID_BACKGROUND_COST = 5;

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
  const points = useGameStore((s) => s.points);
  const spendPoints = useGameStore((s) => s.spendPoints);
  const [selectedBg, setSelectedBg] = useState<BackgroundKey>('grid-bg');
  const [hint, setHint] = useState<string | null>(null);

  const handleSelect = (key: BackgroundKey, cost: number) => {
    if (key === selectedBg) return;

    if (cost > 0 && !spendPoints(cost)) {
      setHint(`需要 ${cost} 头肯`);
      return;
    }

    setHint(null);
    setSelectedBg(key);
    eventBus.emit('request-set-background', { key });
  };

  return (
    <div
      className="shrink-0 flex flex-col border-r border-game-border bg-game-surface/80 backdrop-blur-sm"
      style={{ width: 86 }}
    >
      <div className="shrink-0 px-2 py-2 border-b border-game-border flex items-center justify-between">
        <span className="font-cyber text-[10px] text-accent tracking-wider">BG</span>
        <span className="font-data text-[9px] text-game-text-dim">{BACKGROUNDS.length}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {BACKGROUNDS.map((bg) => {
          const isSelected = selectedBg === bg.key;
          const canAfford = bg.cost === 0 || points >= bg.cost;
          const isDimmed = !isSelected && !canAfford;

          return (
            <button
              key={bg.key}
              type="button"
              onClick={() => handleSelect(bg.key, bg.cost)}
              title={bg.cost === 0 ? `${bg.label} - 免费` : `${bg.label} - ${bg.cost}头肯`}
              className={`w-full border-2 p-1.5 text-left transition-all select-none rounded-none
                         ${isSelected
                  ? 'border-accent bg-accent text-black shadow-[3px_3px_0_#000]'
                  : 'border-game-border/40 bg-game-bg/40 text-game-text-dim hover:border-accent-tertiary hover:text-accent-tertiary'
                }
                         ${isDimmed ? 'opacity-45' : ''}`}
            >
              <div
                className="h-8 w-full border border-black/70"
                style={{ background: bg.preview }}
              />
              <div className="mt-1 flex items-center justify-between gap-1">
                <span className="font-data text-[8px] leading-none truncate">
                  {bg.label}
                </span>
                <span className="font-data text-[8px] leading-none font-bold">
                  {bg.cost === 0 ? 'FREE' : bg.cost}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="shrink-0 min-h-[28px] px-2 py-1.5 border-t border-game-border">
        <span className={`font-data text-[8px] leading-tight ${hint ? 'text-danger' : 'text-game-text-dim/50'}`}>
          {hint ?? '非默认 5 头肯'}
        </span>
      </div>
    </div>
  );
}
