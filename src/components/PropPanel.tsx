// ============================================================
// PropPanel — 道具选择面板（画布左侧，赛博朋克风格）
// 拖拽道具到画布上放置，已放置道具可在画布内拖拽移动
// ============================================================

import { PROP_LIST, PROP_MANIFEST, type PropKey } from '@/phaser/assets/manifest';

export function PropPanel() {
  const handleDragStart = (e: React.DragEvent, key: PropKey) => {
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      className="shrink-0 flex flex-col border-r border-game-border bg-game-surface/80 backdrop-blur-sm"
      style={{ width: 200 }}
    >
      {/* 面板标题 */}
      <div className="shrink-0 px-3 py-2 border-b border-game-border flex items-center gap-2">
        <div className="w-1 h-4 bg-accent" />
        <span className="font-cyber text-[10px] text-accent tracking-wider">PROPS</span>
        <span className="font-data text-[10px] text-game-text-dim ml-auto">
          {PROP_LIST.length}
        </span>
      </div>

      {/* 道具列表 - 2列竖排滚动 */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {PROP_LIST.map((key) => {
            const manifest = PROP_MANIFEST[key];
            return (
              <div
                key={key}
                draggable
                onDragStart={(e) => handleDragStart(e, key)}
                className="flex flex-col items-center gap-1 p-2 rounded border border-game-border/30
                           hover:border-accent/60 hover:bg-accent/5 transition-all text-center
                           cursor-grab active:cursor-grabbing"
              >
                <img
                  src={`/assets/props/${manifest.key}.png`}
                  alt={manifest.label}
                  className="w-10 h-10 object-contain pointer-events-none"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="font-data text-[9px] text-game-text-dim leading-tight pointer-events-none">
                  {manifest.label}
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
