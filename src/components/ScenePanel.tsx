// ============================================================
// ScenePanel — 场景设定选择栏（背景面板下方，竖排切换场景效果）
// ============================================================

import { useGameStore } from '@/store/gameStore';
import { SCENE_CONFIGS } from '@/types';
import type { SceneType } from '@/types';
import { eventBus } from '@/phaser/bridges/PhaserEventBus';

export function ScenePanel() {
  const sceneType = useGameStore((s) => s.sceneType);
  const setSceneType = useGameStore((s) => s.setSceneType);

  const handleSelect = (key: SceneType) => {
    if (key === sceneType) return;
    setSceneType(key);
    eventBus.emit('request-set-scene', { key });
  };

  return (
    <div
      className="shrink-0 flex flex-col border-r border-game-border bg-game-surface/80 backdrop-blur-sm items-center"
      style={{ width: 72 }}
    >
      <div className="shrink-0 px-1.5 py-2 border-b border-game-border flex items-center justify-center w-full">
        <span className="font-cyber text-[10px] text-accent tracking-wider">◇ SCENE</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-2 px-1.5 space-y-1.5 w-full">
        {SCENE_CONFIGS.map((scene) => {
          const isSelected = sceneType === scene.key;

          return (
            <button
              key={scene.key}
              type="button"
              onClick={() => handleSelect(scene.key)}
              title={`${scene.labelCn}: ${scene.description}`}
              className={`w-full border-2 p-1 text-center transition-all select-none rounded-none
                         ${isSelected
                  ? 'border-purple-400 bg-purple-500 text-black shadow-[2px_2px_0_#000]'
                  : 'border-game-border/40 bg-game-bg/40 text-game-text-dim hover:border-purple-300 hover:text-purple-300'
                }`}
            >
              <div
                className="h-7 w-full border border-black/70"
                style={{ background: scene.preview }}
              />
              <div className="mt-0.5 text-center">
                <span className="font-data text-[8px] leading-none">
                  {scene.label}
                </span>
              </div>
              <div className="text-center">
                <span className="font-data text-[7px] leading-none font-bold">
                  {scene.labelCn}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
