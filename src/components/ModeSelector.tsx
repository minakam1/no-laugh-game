// ============================================================
// ModeSelector — 模式选择组件（赛博朋克直播间主页风格）
// ============================================================

import { useState, useEffect } from 'react';
import { useGameStore, DIFFICULTY_CONFIG, PASS_THRESHOLD } from '@/store/gameStore';
import { useAchievementStore } from '@/store/achievementStore';
import { ACHIEVEMENTS } from '@/data/achievements';
import { HoverTranslate } from './HoverTranslate';
import { getSoundManager } from '@/audio/SoundManager';
import type { SaveData } from '@/types';

interface ModeSelectorProps {
  hasSave: boolean;
  saveData: SaveData | null;
  onContinue: () => void;
  onStart: (mode: 'story' | 'endless', level?: number, difficulty?: 'normal' | 'hard') => void;
  onEditApi: () => void;
  onGoShop?: () => void;
}

export function ModeSelector({ hasSave, saveData, onContinue, onStart, onEditApi, onGoShop }: ModeSelectorProps) {
  const unlockedLevels = useGameStore((s) => s.unlockedLevels);
  const bestScores = useGameStore((s) => s.bestScores);
  const endlessHighScore = useGameStore((s) => s.endlessHighScore);
  const kentou = useGameStore((s) => s.kentou);
  const hasBeatenFirstLevel = useGameStore((s) => s.hasBeatenFirstLevel);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const restartTutorial = useGameStore((s) => s.restartTutorial);
  const isHard = difficulty === 'hard';
  const sound = getSoundManager();
  const unlockedAchievements = useAchievementStore((s) => s.unlocked);
  const [showAchievements, setShowAchievements] = useState(false);

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
          <div className="panel-pattern" aria-hidden="true" />
          <div className="corner-brackets hidden sm:block" aria-hidden="true" />
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
          <div className="status-icon absolute bottom-3 left-3 hidden sm:inline-flex text-accent-secondary" aria-hidden="true">
            REC
          </div>

          {/* 主标题 - Logo */}
          <div className="mt-5 mb-4 flex justify-center">
            <img
              src="/logo.png"
              alt="不许笑"
              className="h-40 md:h-48 object-contain"
            />
          </div>
          <p className="font-data text-lg text-game-text-bright">
            // 来一场酣畅淋漓的不要笑挑战吧！
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

          {/* API设置按钮 + 商店入口 */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => { sound.play('ui_button_press'); onEditApi(); }}
              onMouseEnter={() => sound.play('ui_button_hover')}
              className="group w-[130px] min-h-[32px] flex items-center justify-center px-2 py-1.5 border border-game-border text-[10px] font-cyber text-game-text-dim
                         hover:border-accent hover:text-accent transition-all tracking-wider whitespace-nowrap"
            >
              <HoverTranslate text="⚙ SIGNAL CONFIG" hoverText="⚙ 信号配置" />
            </button>
            {onGoShop && (
              <button
                onClick={() => { sound.play('ui_button_press'); onGoShop(); }}
                onMouseEnter={() => sound.play('ui_button_hover')}
                className="group w-[130px] min-h-[32px] flex items-center justify-center px-2 py-1.5 border border-accent-tertiary/60 bg-accent-tertiary/5 text-accent-tertiary text-[10px] font-cyber
                           hover:bg-accent-tertiary/10 hover:border-accent-tertiary transition-all tracking-wider whitespace-nowrap"
              >
                <HoverTranslate text={`🛒 SHOP (${kentou}💰)`} hoverText={`🛒 商店 (${kentou}💰)`} />
              </button>
            )}
            <button
              onClick={() => { sound.play('ui_button_press'); setShowAchievements(true); }}
              onMouseEnter={() => sound.play('ui_button_hover')}
              className="group w-[130px] min-h-[32px] flex items-center justify-center px-2 py-1.5 border border-yellow-500/40 bg-yellow-500/5 text-yellow-400 text-[10px] font-cyber
                         hover:bg-yellow-500/10 hover:border-yellow-500/60 transition-all tracking-wider whitespace-nowrap"
            >
              <HoverTranslate text={`🏆 ACHIEVE [${unlockedAchievements.size}]`} hoverText={`🏆 成就 [${unlockedAchievements.size}]`} />
            </button>
            <button
              onClick={() => { sound.play('ui_button_press'); restartTutorial(); }}
              onMouseEnter={() => sound.play('ui_button_hover')}
              className="group w-[130px] min-h-[32px] flex items-center justify-center px-2 py-1.5 border border-accent/50 bg-accent/5 text-accent text-[10px] font-cyber
                         hover:bg-accent/10 hover:border-accent transition-all tracking-wider whitespace-nowrap"
            >
              <HoverTranslate text="◇ TUTORIAL" hoverText="◇ 重新引导" />
            </button>
          </div>
        </div>

        {/* === 继续游戏 === */}
        {hasSave && saveData && (
          <button
            onClick={() => { sound.play('ui_button_press'); onContinue(); }}
            onMouseEnter={() => sound.play('ui_button_hover')}
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

        {/* === 难度选择 === */}
        <div className={`cyber-panel cyber-corner p-4 ${!hasBeatenFirstLevel ? 'opacity-40' : ''}`}>
          <div className="panel-pattern" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`font-cyber text-sm ${isHard ? 'text-danger' : 'text-accent'}`}>
                {isHard ? '🔥 HARD MODE' : '📺 NORMAL MODE'}
              </span>
              <span className="text-xs text-game-text-dim font-data">
                {isHard ? '衰减翻倍 · 收益减半 · 门槛飙升' : '标准衰减 · 正常收益 · 门槛30'}
              </span>
            </div>
            <button
              onClick={() => {
                if (!hasBeatenFirstLevel) return;
                sound.play(isHard ? 'ui_toggle_off' : 'ui_toggle_on');
                sound.play('ui_difficulty_switch');
                setDifficulty(isHard ? 'normal' : 'hard');
              }}
              disabled={!hasBeatenFirstLevel}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                !hasBeatenFirstLevel
                  ? 'bg-game-border/20 cursor-not-allowed'
                  : isHard
                    ? 'bg-danger/60 shadow-lg shadow-danger/30'
                    : 'bg-accent/40'
              }`}
            >
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all duration-300 ${
                !hasBeatenFirstLevel
                  ? 'left-0.5 bg-game-text-dim/30'
                  : isHard
                    ? 'left-7'
                    : 'left-0.5'
              }`} />
            </button>
          </div>
          {!hasBeatenFirstLevel && (
            <div className="mt-2 text-center font-data text-[10px] text-game-text-dim/50">
              🔒 通关第一局后解锁难度选择
            </div>
          )}
        </div>

        {/* === 故事模式 === */}
        <div className="cyber-panel cyber-corner p-6">
          <div className="panel-pattern" aria-hidden="true" />
          <div className="status-icon absolute top-4 right-4 hidden sm:inline-flex text-accent-secondary" aria-hidden="true">
            STG
          </div>
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent-secondary to-transparent" />

          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 bg-accent-secondary" />
            <div>
              <h2 className="font-cyber text-lg font-bold text-accent-secondary tracking-wider">
                STORY MODE
              </h2>
              <p className="text-xs text-game-text-dim font-data">
                // 别笑，你也过不了第二关
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {[1, 2, 3, 4, 5].map((lv) => {
              const config = DIFFICULTY_CONFIG[lv];
              const locked = lv > unlockedLevels;
              const threshold = isHard ? config.hardPassThreshold : PASS_THRESHOLD;
              return (
                <button
                  key={lv}
                  disabled={locked}
                  onClick={() => { sound.play('ui_stage_select'); onStart('story', lv, difficulty); }}
                  onMouseEnter={() => !locked && sound.play('ui_button_hover')}
                  className={`w-full py-3 px-4 text-left flex items-center justify-between font-data
                    border transition-all ${
                    locked
                      ? 'border-game-border/20 bg-game-bg/20 text-game-text-dim/30 cursor-not-allowed'
                      : isHard
                        ? 'border-danger/30 bg-danger/5 text-game-text-bright hover:border-danger hover:bg-danger/10'
                        : 'border-accent-secondary/40 bg-accent-secondary/5 text-game-text-bright hover:border-accent-secondary hover:bg-accent-secondary/10'
                    }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className={`font-cyber text-xs shrink-0 min-w-[64px] ${
                      locked ? 'text-game-text-dim/30' : isHard ? 'text-danger' : 'text-accent-secondary'
                    }`}>
                      STAGE {String(lv).padStart(2, '0')}
                    </span>
                    <span className="truncate">{config.name}</span>
                  </span>
                  {locked ? (
                    <span className="text-xs font-cyber shrink-0 ml-2 text-game-text-dim/30">LOCKED</span>
                  ) : (
                    <span className={`text-xs shrink-0 ml-2 font-cyber ${isHard ? 'text-danger' : 'text-accent-secondary'}`}>
                      TARGET ≥{threshold}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => { sound.play('ui_button_press'); onStart('story', undefined, difficulty); }}
            onMouseEnter={() => sound.play('ui_button_hover')}
            className={`group cyber-btn w-full ${isHard ? 'cyber-btn-danger' : 'cyber-btn-pink'}`}
            data-tutorial="menu-story-start"
          >
            <HoverTranslate text="◈ START FROM STAGE 01" hoverText="◈ 从第一关开始" />
          </button>
        </div>

        {/* === 无尽模式 === */}
        <div className="cyber-panel cyber-corner p-6">
          <div className="panel-pattern" aria-hidden="true" />
          <div className="status-icon absolute top-4 right-4 hidden sm:inline-flex text-accent-tertiary" aria-hidden="true">
            ∞
          </div>
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
                  onClick={() => { sound.play('ui_stage_select'); onStart('endless', lv); }}
                  onMouseEnter={() => sound.play('ui_button_hover')}
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
            CHANNEL: #BU_XU_XIAO // DEPT: COMEDY-01 // VER: 2.0
          </span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
            <span className="font-data text-[10px] text-success">SERVER ONLINE</span>
          </div>
        </div>
      </div>

      {/* === 成就弹窗 === */}
      {showAchievements && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-game-bg/80 backdrop-blur-sm"
             onClick={() => setShowAchievements(false)}>
          <div className="cyber-panel cyber-corner w-[500px] max-h-[70vh] overflow-hidden flex flex-col"
               onClick={(e) => e.stopPropagation()}>
            <div className="panel-pattern" aria-hidden="true" />
            {/* 头部 */}
            <div className="px-5 py-4 border-b border-game-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <span className="font-cyber text-sm text-yellow-400 tracking-wider">
                  ACHIEVEMENTS <span className="text-game-text-dim">[{unlockedAchievements.size}/{Object.keys(ACHIEVEMENTS).length}]</span>
                </span>
              </div>
              <button
                onClick={() => { sound.play('ui_button_press'); setShowAchievements(false); }}
                className="font-cyber text-game-text-dim hover:text-danger text-xs transition-colors"
              >
                ✕ CLOSE
              </button>
            </div>
            {/* 列表 */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {Object.values(ACHIEVEMENTS).map((ach) => {
                const unlocked = unlockedAchievements.has(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-sm transition-all ${
                      unlocked
                        ? 'bg-yellow-500/5 border border-yellow-500/15'
                        : 'bg-game-bg/50 border border-game-border/30 opacity-50'
                    }`}
                  >
                    <span className={`text-xl shrink-0 ${unlocked ? '' : 'grayscale'}`}>
                      {ach.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-cyber text-[12px] tracking-wider ${unlocked ? 'text-yellow-300' : 'text-game-text-dim'}`}>
                          {ach.title}
                        </span>
                        {unlocked && (
                          <span className="font-cyber text-[8px] text-yellow-500/50 tracking-widest">✓</span>
                        )}
                      </div>
                      <p className="font-data text-[10px] text-game-text-dim/60 leading-relaxed">
                        {unlocked ? ach.desc : '???'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
