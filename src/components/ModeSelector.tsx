// ============================================================
// ModeSelector — 模式选择组件（赛博朋克直播间主页风格）
// ============================================================

import { useGameStore, DIFFICULTY_CONFIG } from '@/store/gameStore';
import type { SaveData } from '@/types';

interface ModeSelectorProps {
  hasSave: boolean;
  saveData: SaveData | null;
  onContinue: () => void;
  onStart: (mode: 'story' | 'endless', level?: number) => void;
  onEditApi: () => void;
}

export function ModeSelector({ hasSave, saveData, onContinue, onStart, onEditApi }: ModeSelectorProps) {
  const unlockedLevels = useGameStore((s) => s.unlockedLevels);

  return (
    <div className="min-h-screen flex items-center justify-center bg-game-bg p-4 relative overflow-hidden">
      {/* 扫描线背景 */}
      <div className="absolute inset-0 scanlines pointer-events-none" />

      {/* 背景装饰网格 */}
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

      <div className="max-w-2xl w-full space-y-6 relative z-10">
        {/* === 直播间标题区 === */}
        <div className="cyber-panel cyber-corner p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent-secondary via-accent to-accent-secondary" />

          {/* LIVE 角标 */}
          <div className="absolute top-3 left-3">
            <span className="live-badge">LIVE</span>
          </div>

          {/* 在线人数 */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
            <span className="font-data text-xs text-viewer-count">
              {Math.floor(Math.random() * 5000 + 10000).toLocaleString()} VIEWERS
            </span>
          </div>

          {/* 主标题 */}
          <h1 className="font-cyber text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent-secondary to-accent-tertiary mt-6 mb-3 tracking-wider animate-neon-flicker">
            不许笑
          </h1>
          <p className="font-data text-lg text-game-text-dim tracking-wide">
            // 玩家搭场景 · AI 当观众 · 绷不住了算我输
          </p>

          {/* 信号状态条 */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-data text-[10px] text-game-text-dim">SIGNAL</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-1 h-3 bg-success rounded-sm" />
                ))}
              </div>
            </div>
            <div className="w-px h-4 bg-game-border" />
            <div className="flex items-center gap-1.5">
              <span className="font-data text-[10px] text-game-text-dim">LATENCY</span>
              <span className="font-data text-[10px] text-accent">12ms</span>
            </div>
            <div className="w-px h-4 bg-game-border" />
            <div className="flex items-center gap-1.5">
              <span className="font-data text-[10px] text-game-text-dim">QUALITY</span>
              <span className="font-data text-[10px] text-accent-secondary">4K</span>
            </div>
          </div>

          {/* API设置按钮 */}
          <button
            onClick={onEditApi}
            className="mt-4 px-4 py-1.5 border border-game-border text-[10px] font-cyber text-game-text-dim
                       hover:border-accent hover:text-accent transition-all tracking-wider"
          >
            ⚙ SIGNAL CONFIG
          </button>
        </div>

        {/* === 继续游戏 === */}
        {hasSave && saveData && (
          <button
            onClick={onContinue}
            className="w-full py-4 cyber-glow-border bg-success/5
                       text-success font-cyber text-sm tracking-widest
                       hover:bg-success/10 transition-all animate-fade-in font-data"
          >
            <span className="text-base">▶ RESUME BROADCAST</span>
            <span className="block text-xs font-normal text-game-text-dim mt-1 font-data tracking-normal">
              {saveData.storyProgress.unlockedLevels > 1
                ? `已解锁 ${saveData.storyProgress.unlockedLevels} 个舞台`
                : '故事模式直播中'}
            </span>
          </button>
        )}

        {/* === 故事模式 === */}
        <div className="cyber-panel cyber-corner p-6">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent-secondary to-transparent" />

          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-accent-secondary" />
            <div>
              <h2 className="font-cyber text-lg font-bold text-accent-secondary tracking-wider">
                STORY MODE
              </h2>
              <p className="text-xs text-game-text-dim font-data">
                // 5 关递进挑战，从"快乐小狗"到"冷面裁判官"
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {[1, 2, 3, 4, 5].map((lv) => {
              const config = DIFFICULTY_CONFIG[lv];
              const locked = lv > unlockedLevels;
              return (
                <button
                  key={lv}
                  disabled={locked}
                  onClick={() => onStart('story', lv)}
                  className={`w-full py-3 px-4 text-left flex items-center justify-between font-data
                    border transition-all ${
                    locked
                      ? 'border-game-border/30 bg-game-bg/30 text-game-text-dim/30 cursor-not-allowed'
                      : 'border-game-border hover:border-accent-secondary hover:bg-accent-secondary/5 text-game-text'
                    }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="font-cyber text-xs text-game-text-dim">
                      STAGE {String(lv).padStart(2, '0')}
                    </span>
                    <span>{config.name}</span>
                  </span>
                  {locked ? (
                    <span className="text-xs font-cyber">LOCKED</span>
                  ) : (
                    <span className="text-xs text-game-text-dim">
                      TARGET ≥{config.targetAvgScore}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onStart('story')}
            className="cyber-btn cyber-btn-pink w-full"
          >
            ◈ START FROM STAGE 01
          </button>
        </div>

        {/* === 无尽模式 === */}
        <div className="cyber-panel cyber-corner p-6">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent-tertiary to-transparent" />

          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-accent-tertiary" />
            <div>
              <h2 className="font-cyber text-lg font-bold text-accent-tertiary tracking-wider">
                ENDLESS MODE
              </h2>
              <p className="text-xs text-game-text-dim font-data">
                // 自选难度，无限回合，冲击最高分
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((lv) => {
              const config = DIFFICULTY_CONFIG[lv];
              return (
                <button
                  key={lv}
                  onClick={() => onStart('endless', lv)}
                  className="flex-1 py-3 border border-game-border hover:border-accent-tertiary
                             text-game-text text-xs font-cyber tracking-wider transition-all
                             hover:bg-accent-tertiary/5"
                >
                  LV{lv}
                  <span className="block text-[10px] font-normal text-game-text-dim mt-0.5 font-data">
                    {config.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* === 底部信息 === */}
        <div className="flex items-center justify-between pt-2">
          <span className="font-data text-[10px] text-game-text-dim tracking-wider">
            CHANNEL: #BU_XU_XIAO // CYBER_PUNK_EDITION v2.0
          </span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
            <span className="font-data text-[10px] text-success">SERVER ONLINE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
