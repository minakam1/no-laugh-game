// ============================================================
// Shop — 场外商店（赛博朋克公会风格）
// 购买道具降低挑战难度
// ============================================================

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore, SHOP_ITEMS, type ShopItem } from '@/store/gameStore';
import { HoverTranslate } from './HoverTranslate';
import { getSoundManager } from '@/audio/SoundManager';

interface ShopProps {
  onBack: () => void;
}

export function Shop({ onBack }: ShopProps) {
  const kentou = useGameStore((s) => s.kentou);
  const hasBeatenFirstLevel = useGameStore((s) => s.hasBeatenFirstLevel);
  const inventory = useGameStore((s) => s.inventory);
  const unlockedScenes = useGameStore((s) => s.unlockedScenes);
  const buyShopItem = useGameStore((s) => s.buyShopItem);

  const [popup, setPopup] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const sound = getSoundManager();

  const showPopup = useCallback((text: string, type: 'success' | 'error') => {
    setPopup({ text, type });
    setTimeout(() => setPopup(null), 2500);
  }, []);

  const handleBuy = (item: ShopItem) => {
    const owned = item.sceneUnlock && unlockedScenes.includes(item.sceneUnlock)
      ? 1
      : inventory[item.id] || 0;
    if (owned >= item.maxOwn) {
      sound.play('ui_purchase_fail');
      showPopup(`已达到最大持有数 (${item.maxOwn})`, 'error');
      return;
    }
    if (kentou < item.cost) {
      sound.play('ui_purchase_fail');
      showPopup('肯头不足！通关赚取更多吧 💰', 'error');
      return;
    }
    const success = buyShopItem(item.id);
    if (success) {
      sound.play('ui_purchase');
      showPopup(`${item.sceneUnlock ? '解锁成功' : '购买成功'}！获得 ${item.emoji} ${item.name}`, 'success');
    } else {
      sound.play('ui_purchase_fail');
      showPopup('购买失败', 'error');
    }
  };

  const items = Object.values(SHOP_ITEMS);

  return (
    <div className="h-full flex flex-col bg-game-bg relative overflow-hidden">
      {/* 扫描线 */}
      <div className="absolute inset-0 scanlines pointer-events-none z-50" />

      {/* 背景网格 */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(var(--accent) 1px, transparent 1px),
            linear-gradient(90deg, var(--accent) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* === 顶栏 === */}
      <div className="shrink-0 border-b border-game-border bg-game-surface/80 backdrop-blur-sm relative z-10">
        <div className="panel-pattern" aria-hidden="true" />
        <div className="h-[2px] bg-gradient-to-r from-accent-tertiary via-accent-secondary to-accent-tertiary" />
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="font-cyber text-sm text-accent-tertiary tracking-wider">
              🛒 GUILD
            </span>
            <span className="status-icon hidden sm:inline-flex text-accent-tertiary" aria-hidden="true">GLD</span>
            <span className="font-data text-[10px] text-game-text-dim">
              // 道具降低挑战难度，让质检员放你一马
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-accent/10 border border-accent/30 rounded">
              <span className="text-sm">💰</span>
              <span className="font-data text-sm text-accent font-bold">{kentou}</span>
              <span className="font-data text-[10px] text-game-text-dim">肯头</span>
            </div>
            <button
              onClick={() => { sound.play('ui_button_press'); onBack(); }}
              onMouseEnter={() => sound.play('ui_button_hover')}
              className="group px-3 py-1 border border-game-border text-[10px] font-cyber text-game-text-dim
                         hover:border-accent hover:text-accent transition-all tracking-wider"
            >
              <HoverTranslate text="BACK" hoverText="返回" />
            </button>
          </div>
        </div>
      </div>

      {/* 消息弹窗 — portal 渲染不改变布局 */}
      {popup && createPortal(
        <div className="fixed inset-0 z-[99998] flex items-center justify-center pointer-events-none">
          <div className={`px-8 py-4 rounded-md backdrop-blur-md border animate-super-chat-enter ${
            popup.type === 'success'
              ? 'bg-success/20 border-success/40 text-success'
              : 'bg-danger/20 border-danger/40 text-danger'
          }`}>
            <span className="font-cyber text-sm tracking-widest">{popup.text}</span>
          </div>
        </div>,
        document.body,
      )}

      {/* === 道具列表 === */}
      <div className="flex-1 overflow-y-auto px-4 py-4 relative z-10">
        {/* 锁定遮罩：未通关第一局 */}
        {!hasBeatenFirstLevel && (
          <div className="max-w-lg mx-auto mb-4 p-6 border border-game-border/30 bg-game-bg/80 text-center">
            <div className="text-3xl mb-2">🔒</div>
            <h3 className="font-cyber text-sm text-game-text-dim tracking-wider mb-1">
              商店未解锁
            </h3>
            <p className="font-data text-xs text-game-text-dim/60">
              通关第一局游戏后解锁公会
            </p>
          </div>
        )}
        <div className={`max-w-lg mx-auto space-y-3 ${!hasBeatenFirstLevel ? 'opacity-30 pointer-events-none' : ''}`}>
          {items.map((item) => {
            const owned = item.sceneUnlock && unlockedScenes.includes(item.sceneUnlock)
              ? 1
              : inventory[item.id] || 0;
            const maxed = owned >= item.maxOwn;
            const canAfford = kentou >= item.cost;

            return (
              <div
                key={item.id}
                className={`p-4 border transition-all relative overflow-hidden ${
                  maxed
                    ? 'border-game-border/20 bg-game-surface/30 opacity-50'
                    : canAfford
                      ? 'border-game-border bg-game-surface hover:border-accent-tertiary/50 hover:bg-game-surface/80'
                      : 'border-game-border/30 bg-game-surface/50 opacity-70'
                }`}
              >
                <div className="panel-pattern" aria-hidden="true" />
                <div className="flex items-start gap-3">
                  {/* 道具图标 */}
                  <div className={`shrink-0 w-12 h-12 flex items-center justify-center text-2xl border ${
                    maxed
                      ? 'border-game-border/20 bg-game-bg/30'
                      : 'border-accent-tertiary/30 bg-accent-tertiary/5'
                  }`}>
                    {item.emoji}
                  </div>

                  {/* 道具信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-cyber text-sm text-game-text tracking-wider">
                        {item.name}
                      </h3>
                      <span className="font-data text-[10px] text-game-text-dim">
                        ×{owned}/{item.maxOwn}
                      </span>
                    </div>
                    <p className="font-data text-xs text-game-text-dim mt-0.5">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`font-data text-xs font-bold ${
                        maxed ? 'text-game-text-dim' : 'text-accent'
                      }`}>
                        💰 {item.cost} 肯头
                      </span>
                    </div>
                  </div>

                  {/* 购买按钮 */}
                  <button
                    onClick={() => handleBuy(item)}
                    onMouseEnter={() => !maxed && canAfford && sound.play('ui_button_hover')}
                    disabled={maxed || !canAfford}
                    className={`group shrink-0 px-4 py-2 font-cyber text-xs tracking-wider border transition-all ${
                      maxed
                        ? 'border-game-border/20 text-game-text-dim/30 cursor-not-allowed'
                        : canAfford
                          ? 'border-accent-tertiary/60 bg-accent-tertiary/10 text-accent-tertiary hover:bg-accent-tertiary/20 hover:border-accent-tertiary'
                          : 'border-game-border/30 text-game-text-dim/50 cursor-not-allowed'
                    }`}
                  >
                    {maxed ? (
                      <HoverTranslate text="MAX" hoverText="已满" />
                    ) : (
                      <HoverTranslate text="BUY" hoverText="购买" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部说明 */}
        <div className="max-w-lg mx-auto mt-6 p-4 border border-accent/20 bg-accent/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">💡</span>
            <span className="font-cyber text-[10px] text-accent tracking-wider">使用说明</span>
          </div>
          <ul className="space-y-1.5 font-data text-[10px] text-game-text-dim">
            <li>• 道具购买后在<b className="text-game-text">游戏中使用</b>（LiveStage 顶部道具栏）</li>
            <li>• 一次性效果在<b className="text-game-text">当前回合</b>生效后消耗</li>
            <li>• 延时沙漏为<b className="text-game-text">全局效果</b>，整关有效</li>
            <li>• 场景许可购买后会<b className="text-game-text">永久解锁</b>对应场景</li>
            <li>• 肯头通过<b className="text-accent">通关加分</b>获得（超出门槛的绷不住值）</li>
            <li>• 更快通关、更少轮数 = <b className="text-accent-secondary">更多肯头！</b></li>
          </ul>
        </div>
      </div>

      {/* === 底栏 === */}
      <div className="shrink-0 border-t border-game-border px-4 py-2 flex items-center justify-between relative z-10 bg-game-surface/80">
        <span className="font-data text-[10px] text-game-text-dim tracking-wider">
          GUILD // ITEMS: {items.length} // OWNED: {Object.values(inventory).reduce((a, b) => a + b, 0) + items.filter((item) => item.sceneUnlock && unlockedScenes.includes(item.sceneUnlock)).length} // EL-PSY-KONGROO
        </span>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-accent-tertiary rounded-full animate-pulse" />
          <span className="font-data text-[10px] text-accent-tertiary">OPEN</span>
        </div>
      </div>
    </div>
  );
}
