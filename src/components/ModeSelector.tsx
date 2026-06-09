// ============================================================
// ModeSelector — 模式选择组件（赛博朋克直播间主页风格）
// ============================================================

import { useState, useEffect } from 'react';
import { useGameStore, DIFFICULTY_CONFIG, PASS_THRESHOLD } from '@/store/gameStore';
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
  const bestScores = useGameStore((s) => s.bestScores);
  const endlessHighScore = useGameStore((s) => s.endlessHighScore);

  // 基于历史最佳成绩计算观众基数（分数越高观众越多）
  const maxBestScore = Math.max(0, ...Object.values(bestScores));
  const topScore = Math.max(maxBestScore, endlessHighScore);
  const baseViewers = 1000 + topScore * 300; // 0分→1000, 30分→10000, 100分→31000

  // ---- 观众数波动（基于历史分数 + 大幅随机，允许减少）----
  const [viewerCount, setViewerCount] = useState(() =>
    Math.floor(baseViewers + (Math.random() - 0.5) * 400)
  );
  useEffect(() => {
    const interval = setInterval(() => {
      const target = baseViewers;
      setViewerCount((prev) => {
        const drift = (target - prev) * 0.2;
        // 大幅随机：可能暴增也可能暴跌
        const roll = Math.random();
        let jitter: number;
        if (roll > 0.92) {
          jitter = -Math.floor(Math.random() * 1500); // 8% 概率暴跌 0~1500
        } else if (roll > 0.85) {
          jitter = Math.floor(Math.random() * 2000);   // 7% 概率暴涨 0~2000
        } else {
          jitter = Math.floor((Math.random() - 0.5) * 600); // 正常波动 ±300
        }
        return Math.max(100, Math.min(99999, Math.round(prev + drift + jitter)));
      });
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [baseViewers]);

  // ---- SIGNAL 信号强度波动 ----
  const [signalBars, setSignalBars] = useState(4);
  useEffect(() => {
    const interval = setInterval(() => {
      // 大部分时间4格，偶尔掉到3或2格，极少掉到1格
      const roll = Math.random();
      if (roll > 0.85) setSignalBars(3);
      else if (roll > 0.96) setSignalBars(2);
      else if (roll > 0.99) setSignalBars(1);
      else setSignalBars(4);
    }, 2000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);

  // ---- LATENCY 延迟波动 ----
  const [latency, setLatency] = useState(12);
  useEffect(() => {
    const interval = setInterval(() => {
      // 在 8~28ms 之间波动
      const newLatency = Math.floor(8 + Math.random() * 20);
      setLatency(newLatency);
    }, 1500 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex items-start justify-center p-3 md:p-4 relative overflow-y-auto overflow-x-hidden">
      {/* 左侧背景图 — bg1 的左半 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-3/5 pointer-events-none z-0"
        style={{
          backgroundImage: 'url(/bg-left.png)',
          backgroundSize: 'auto 100%',
          backgroundPosition: 'left center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.3,
        }}
      />
      {/* 右侧背景图 — bg1 的右半 */}
      <div
        className="absolute right-0 top-0 bottom-0 w-3/5 pointer-events-none z-0"
        style={{
          backgroundImage: 'url(/bg-right.png)',
          backgroundSize: 'auto 100%',
          backgroundPosition: 'right center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.3,
        }}
      />

      {/* 扫描线背景 */}
      <div className="absolute inset-0 scanlines pointer-events-none z-[1]" />

      {/* 背景装饰网格 */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] z-[1]"
        style={{
          backgroundImage: `
            linear-gradient(var(--accent) 1px, transparent 1px),
            linear-gradient(90deg, var(--accent) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="max-w-lg w-full space-y-4 md:space-y-5 py-2 relative z-10">
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
              {viewerCount.toLocaleString()} VIEWERS
            </span>
          </div>

          {/* 主标题 - Logo */}
          <div className="mt-6 mb-5 flex justify-center">
            <img
              src="/logo.png"
              alt="不许笑"
              className="h-32 md:h-36 object-contain"
            />
          </div>
          <p className="font-data text-lg text-game-text-bright">
            // 玩家搭场景 · AI 当观众 · 绷不住了算我输
          </p>

          {/* 信号状态条 */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-data text-[10px] text-game-text-dim">SIGNAL</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`w-1 h-3 rounded-sm transition-all duration-300 ${
                      i <= signalBars ? 'bg-success' : 'bg-game-border/30'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="w-px h-4 bg-game-border" />
            <div className="flex items-center gap-1.5">
              <span className="font-data text-[10px] text-game-text-dim">LATENCY</span>
              <span className="font-data text-[10px] text-accent">{latency}ms</span>
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
                      ? 'border-game-border/20 bg-game-bg/20 text-game-text-dim/30 cursor-not-allowed'
                      : 'border-accent-secondary/40 bg-accent-secondary/5 text-game-text-bright hover:border-accent-secondary hover:bg-accent-secondary/10'
                    }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className={`font-cyber text-xs shrink-0 min-w-[64px] ${
                      locked ? 'text-game-text-dim/30' : 'text-accent-secondary'
                    }`}>
                      STAGE {String(lv).padStart(2, '0')}
                    </span>
                    <span className="truncate">{config.name}</span>
                  </span>
                  {locked ? (
                    <span className="text-xs font-cyber shrink-0 ml-2 text-game-text-dim/30">LOCKED</span>
                  ) : (
                    <span className="text-xs text-accent-secondary shrink-0 ml-2 font-cyber">
                      TARGET ≥{PASS_THRESHOLD}
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
            CHANNEL: #BU_XU_XIAO // NEO_BRUTAL_SIGNAL v2.0
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
