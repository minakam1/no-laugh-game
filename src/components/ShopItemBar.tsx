// ============================================================
// ShopItemBar — 游戏中商店道具快速使用栏
// 显示在顶栏下方，可快速使用已购买的降低难度道具
// ============================================================

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore, SHOP_ITEMS } from '@/store/gameStore';
import { getSoundManager } from '@/audio/SoundManager';

export function ShopItemBar() {
  const sound = getSoundManager();
  const inventory = useGameStore((s) => s.inventory);
  const activateShopItem = useGameStore((s) => s.useShopItem);
  const activeShopEffects = useGameStore((s) => s.activeShopEffects);
  const [popup, setPopup] = useState<{ text: string; type: 'success' | 'fail' } | null>(null);

  const ownedItems = Object.entries(inventory)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ item: SHOP_ITEMS[id], count }))
    .filter(({ item }) => item != null);

  const showPopup = useCallback((text: string, type: 'success' | 'fail') => {
    setPopup({ text, type });
    setTimeout(() => setPopup(null), 2000);
  }, []);

  if (ownedItems.length === 0) return null;

  const handleUse = (itemId: string, itemName: string) => {
    const success = activateShopItem(itemId);
    if (success) {
      sound.play('ui_purchase');
      showPopup(`使用 ${itemName}！效果已激活`, 'success');
    } else {
      sound.play('ui_purchase_fail');
      showPopup('使用失败', 'fail');
    }
  };

  return (
    <>
      <div className="shrink-0 border-b border-game-border/30 bg-game-surface/40 relative z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 overflow-x-auto">
          <span className="font-cyber text-[9px] text-game-text-dim tracking-wider shrink-0">
            🎒 道具:
          </span>
          {ownedItems.map(({ item, count }) => {
            const isActive = activeShopEffects.includes(item.effect);
            return (
              <button
                key={item.id}
                onClick={() => handleUse(item.id, item.name)}
                disabled={isActive && item.effect !== 'rounds_plus_2'}
                className={`shrink-0 flex items-center gap-1 px-2 py-1 border text-[10px] font-data transition-all ${
                  isActive && item.effect !== 'rounds_plus_2'
                    ? 'border-success/40 bg-success/10 text-success cursor-not-allowed'
                    : 'border-accent-tertiary/40 bg-accent-tertiary/5 text-accent-tertiary hover:bg-accent-tertiary/15 hover:border-accent-tertiary'
                }`}
                title={item.description}
              >
                <span className="text-xs">{item.emoji}</span>
                <span>{item.name}</span>
                <span className="text-game-text-dim">×{count}</span>
                {isActive && <span className="text-success text-[8px]">✓</span>}
              </button>
            );
          })}
          <span className="font-data text-[9px] text-game-text-dim/50 ml-auto shrink-0">
            点击使用 · 一次性效果
          </span>
        </div>
      </div>
      {popup && createPortal(
        <div className="fixed inset-0 z-[99998] flex items-center justify-center pointer-events-none">
          <div className={`px-8 py-4 rounded-md backdrop-blur-md border animate-super-chat-enter ${
            popup.type === 'success'
              ? 'bg-success/20 border-success/40 text-success'
              : 'bg-accent/20 border-accent/40 text-accent'
          }`}>
            <span className="font-cyber text-sm tracking-widest">{popup.text}</span>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
