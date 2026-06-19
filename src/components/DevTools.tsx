// ============================================================
// DevTools — 开发者模式：回放剧情 / 解锁全部
// ============================================================

import { useState, useCallback } from 'react';
import { clearStoredSave, useGameStore } from '@/store/gameStore';
import { useAchievementStore } from '@/store/achievementStore';
import { getSoundManager } from '@/audio/SoundManager';

interface SceneItem {
  id: string;
  label: string;
}

const SCENES: SceneItem[] = [
  { id: 'prologue', label: '完整序章（字幕 + 对话）' },
  { id: 'tutorial', label: '新手引导' },
  { id: 'unlock', label: '🔓 解锁全部关卡 + 10000 肯头' },
];

interface DevToolsProps {
  onReplayPrologue: () => void;
  onReplayTutorial: () => void;
  onClearGameRecords: () => void;
}

export function DevTools({ onReplayPrologue, onReplayTutorial, onClearGameRecords }: DevToolsProps) {
  const [open, setOpen] = useState(false);

  const handleToggle = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  const handleReplay = useCallback(
    (id: string) => {
      setOpen(false);
      if (id === 'prologue') onReplayPrologue();
      if (id === 'tutorial') onReplayTutorial();
      if (id === 'unlock') {
        const sound = getSoundManager();
        sound.play('ui_purchase');
        // 解锁全部5关
        useGameStore.setState({ unlockedLevels: 5, unlockedScenes: ['normal', 'cliff', 'rapids', 'darkness', 'windstorm'] });
        // 添加 10000 肯头
        useGameStore.getState().addKentou(10000);
        // 标记已击败第一关（解锁商店）
        useGameStore.setState({ hasBeatenFirstLevel: true });
        // 触发肯头相关成就
        useAchievementStore.getState().trackKentou(10000);
      }
    },
    [onReplayPrologue, onReplayTutorial],
  );

  const handleClearCache = useCallback(async () => {
    const confirmed = window.confirm('确定清理游戏记录？关卡进度、分数、肯头、商店库存和成就会恢复初始状态。API 配置会保留。');
    if (!confirmed) return;

    const sound = getSoundManager();
    sound.play('ui_button_press');
    await clearStoredSave();
    useGameStore.getState().resetGameRecords();
    useAchievementStore.getState().resetAchievements();
    onClearGameRecords();
    setOpen(false);
  }, [onClearGameRecords]);

  return (
    <>
      {/* 按钮 */}
      <button
        className="fixed bottom-2 left-2 z-[400] px-3 py-1
                   bg-black/50 border border-game-border/30 text-game-text-dim/40
                   font-cyber text-[10px] tracking-widest
                   hover:border-accent-secondary/50 hover:text-accent-secondary/60
                   transition-all cursor-pointer select-none"
        onClick={handleToggle}
        title="开发者模式"
      >
        DEV
      </button>

      {/* 菜单面板 */}
      {open && (
        <div
          className="fixed inset-0 z-[399] flex items-end justify-start pb-12 pl-2 pr-2"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-black/90 border border-game-border rounded-sm px-6 py-4 mb-2 backdrop-blur-sm max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-cyber text-accent text-xs tracking-[4px] mb-3 text-center">
              ▣ DEV MODE
            </p>
            <div className="flex flex-col gap-1.5">
              {SCENES.map((scene) => (
                <button
                  key={scene.id}
                  className={`w-full text-left px-3 py-2 border border-game-border/30
                             bg-game-surface/50 text-sm font-data
                             hover:border-accent-secondary hover:text-game-text
                             transition-all ${
                               scene.id === 'unlock'
                                 ? 'text-accent border-accent/30 bg-accent/5'
                                 : 'text-game-text-dim'
                             }`}
                  onClick={() => handleReplay(scene.id)}
                >
                  {scene.id === 'unlock' ? scene.label : `▸ ${scene.label}`}
                </button>
              ))}
              <button
                className="w-full text-left px-3 py-2 mt-2 border border-danger/40
                           bg-danger/10 text-danger text-sm font-data
                           hover:border-danger hover:text-game-text
                           transition-all"
                onClick={handleClearCache}
              >
                ▸ 清理缓存（游戏记录）
              </button>
            </div>
            <p className="text-game-text-dim/30 font-data text-[9px] mt-3 text-center">
              点击外部关闭
            </p>
          </div>
        </div>
      )}
    </>
  );
}
