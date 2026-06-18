// ============================================================
// PropPanel — 道具选择面板（画布左侧，赛博朋克风格）
// 拖拽道具到画布上放置，已放置道具可在画布内拖拽移动
// ============================================================

import { PROP_LIST, PROP_MANIFEST, type PropKey } from '@/phaser/assets/manifest';
import { useGameStore } from '@/store/gameStore';

export function PropPanel() {
  const points = useGameStore((s) => s.points);

  const handleDragStart = (e: React.DragEvent, key: PropKey) => {
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // 按价格排序
  const sortedProps = [...PROP_LIST].sort(
    (a, b) => PROP_MANIFEST[a].cost - PROP_MANIFEST[b].cost
  );

  return (
    <div
      className="flex-1 min-h-0 flex flex-col border-r border-game-border bg-game-surface/80 backdrop-blur-sm relative overflow-hidden"
      style={{ width: 220 }}
    >
      <div className="panel-pattern" aria-hidden="true" />
      {/* 面板标题 */}
      <div className="shrink-0 px-3 py-2 border-b border-game-border flex items-center gap-2">
        <div className="w-1 h-4 bg-accent" />
        <span className="font-cyber text-[10px] text-accent tracking-wider">PROPS</span>
        <span className="status-icon text-accent-tertiary" aria-hidden="true">BOX</span>
        <span className="font-data text-[10px] text-game-text-dim ml-auto">
          {PROP_LIST.length}
        </span>
      </div>

      {/* 头肯余额 */}
      <div className="shrink-0 px-3 py-1.5 border-b border-game-border/30 bg-accent/5 flex items-center gap-2">
        <span className="text-xs">💰</span>
        <span className="font-data text-[11px] text-accent font-bold">{points}</span>
        <span className="font-data text-[9px] text-game-text-dim">头肯</span>
      </div>

      {/* 道具列表 - 2列竖排滚动 */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {sortedProps.map((key) => {
            const manifest = PROP_MANIFEST[key];
            const canAfford = points >= manifest.cost;
            return (
              <div
                key={key}
                draggable={canAfford}
                onDragStart={(e) => canAfford && handleDragStart(e, key)}
                data-tutorial={key === 'banana' ? 'game-prop-banana' : undefined}
                className={`flex flex-col items-center gap-1 p-2 rounded border transition-all text-center relative
                           ${canAfford
                             ? 'border-game-border/30 hover:border-accent/60 hover:bg-accent/5 cursor-grab active:cursor-grabbing'
                             : 'border-game-border/20 opacity-40 cursor-not-allowed'}`}
              >
                {key === 'wishMachine' ? (
                  <div
                    aria-label={manifest.label}
                    className="w-16 h-16 pointer-events-none flex items-center justify-center"
                  >
                    <div className="w-10 h-10 rounded-full border-2 border-purple-200/70 bg-purple-700 shadow-[0_0_18px_rgba(168,85,247,0.5)] flex items-center justify-center">
                      <span className="font-cyber text-lg text-white">?</span>
                    </div>
                  </div>
                ) : key === 'clumsyNpc' ? (
                  <div className="w-16 h-16 pointer-events-none bg-white/15 rounded flex items-center justify-center" aria-label={manifest.label}>
                    <img
                      src="/assets/props/prop-npc.png"
                      alt="NPC"
                      className="w-14 h-14 object-contain"
                    />
                  </div>
                ) : (
                  <img
                    src={`/assets/props/${manifest.key}.png`}
                    alt={manifest.label}
                    className="w-16 h-16 object-contain pointer-events-none"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <span className="font-data text-[10px] text-game-text-dim leading-tight pointer-events-none">
                  {manifest.label}
                </span>
                {/* 价格角标 */}
                <span className={`absolute top-1 right-1 font-cyber text-[8px] px-1 py-0.5 rounded-sm
                  ${canAfford ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-danger/20 text-danger/60 border border-danger/20'}`}>
                  {manifest.cost}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="shrink-0 px-2 py-1.5 border-t border-game-border">
        <span className="font-data text-[8px] text-game-text-dim/50">
          拖拽道具到画布上
        </span>
      </div>
    </div>
  );
}
