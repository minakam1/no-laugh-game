// ============================================================
// ResultModal — 通关/失败结算弹窗（赛博朋克直播结算面板）
// ============================================================

import { useMemo, useEffect, useRef, useState } from 'react';
import { useGameStore, DIFFICULTY_CONFIG, getPassThreshold } from '@/store/gameStore';
import { HoverTranslate } from './HoverTranslate';
import { getSoundManager } from '@/audio/SoundManager';

interface ResultModalProps {
  onBackToMenu: () => void;
  onGoShop?: () => void;
}

export function ResultModal({ onBackToMenu, onGoShop }: ResultModalProps) {
  const phase = useGameStore((s) => s.phase);

  if (phase !== 'result') return null;

  return <ResultModalInner onBackToMenu={onBackToMenu} onGoShop={onGoShop} />;
}

function ResultModalInner({ onBackToMenu, onGoShop }: ResultModalProps) {
  const sound = getSoundManager();
  const meter = useGameStore((s) => s.meter);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const mode = useGameStore((s) => s.mode);
  const difficulty = useGameStore((s) => s.difficulty);
  const unlockedLevels = useGameStore((s) => s.unlockedLevels);
  const bestScores = useGameStore((s) => s.bestScores);
  const nextLevel = useGameStore((s) => s.nextLevel);
  const reset = useGameStore((s) => s.reset);
  const setMode = useGameStore((s) => s.setMode);
  const calcBonusPoints = useGameStore((s) => s.calcBonusPoints);
  const addKentou = useGameStore((s) => s.addKentou);
  const [showBonusDetails, setShowBonusDetails] = useState(false);

  const threshold = getPassThreshold(currentLevel, difficulty);
  const totalValue = Math.round(meter.value);
  const passed = totalValue >= threshold;
  const isEndless = mode === 'endless';
  const isHard = difficulty === 'hard';

  // 计算加分奖励（故事/测试模式通关时）
  const bonus = useMemo(() => {
    if (isEndless || !passed) return null;
    return calcBonusPoints();
  }, [isEndless, passed, calcBonusPoints]);

  // 仅在首次渲染时发放头肯（使用 useEffect 避免在 render 期间更新状态）
  const kentouClaimedRef = useRef(false);
  useEffect(() => {
    if (bonus && !kentouClaimedRef.current) {
      kentouClaimedRef.current = true;
      if (bonus.kentouEarned > 0) {
        addKentou(bonus.kentouEarned);
      }
    }
  }, [bonus, addKentou]);

  const avgScore = meter.rounds.length > 0
    ? (meter.rounds.reduce((sum, r) => sum + r.funnyScore, 0) / meter.rounds.length).toFixed(1)
    : '0.0';

  const handleNextLevel = () => {
    sound.play('ui_button_press');
    nextLevel();
  };

  const handleRetry = () => {
    sound.play('ui_button_press');
    reset();
  };

  const handleEndlessContinue = () => {
    sound.play('ui_button_press');
    reset();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      {/* 左侧背景图 — bgwin 的左半 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-3/5 pointer-events-none"
        style={{
          backgroundImage: 'url(/bgwin-left.png)',
          backgroundSize: 'auto 100%',
          backgroundPosition: 'left center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.25,
        }}
      />
      {/* 右侧背景图 — bgwin 的右半 */}
      <div
        className="absolute right-0 top-0 bottom-0 w-3/5 pointer-events-none"
        style={{
          backgroundImage: 'url(/bgwin-right.png)',
          backgroundSize: 'auto 100%',
          backgroundPosition: 'right center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.25,
        }}
      />

      {/* 扫描线 */}
      <div className="absolute inset-0 scanlines pointer-events-none" />

      <div className="cyber-panel cyber-corner max-w-md w-full mx-4 p-8 animate-slide-up relative z-10 overflow-hidden" data-tutorial="result-modal">
        <div className="panel-pattern" aria-hidden="true" />
        <div className="corner-brackets hidden sm:block" aria-hidden="true" />
        <div className={`status-icon absolute top-4 right-4 hidden sm:inline-flex ${
          passed && !isEndless
            ? 'text-success'
            : isEndless
              ? 'text-accent-tertiary'
              : 'text-danger'
        }`} aria-hidden="true">
          RANK
        </div>
        {/* 顶部霓虹条 */}
        <div className={`h-[2px] ${
          passed && !isEndless
            ? 'bg-gradient-to-r from-success via-accent to-success'
            : isEndless
              ? 'bg-gradient-to-r from-accent-tertiary via-accent to-accent-tertiary'
              : 'bg-gradient-to-r from-danger via-accent-secondary to-danger'
        }`} />

        {/* 标题 */}
        <div className="text-center mb-6 mt-2">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center border border-accent/40 bg-accent/10 text-xl">
            {isEndless ? '◇' : passed ? '🏆' : '×'}
          </div>
          <span className="font-cyber text-[10px] text-game-text-dim tracking-[4px] block mb-2">
            BROADCAST ENDED
          </span>
          <h2 className={`font-cyber text-2xl font-black tracking-wider ${
            passed && !isEndless
              ? 'text-success'
              : isEndless
                ? 'text-accent'
                : 'text-danger'
          }`}>
            {isEndless
              ? 'STREAM STATS'
              : passed
                ? 'STAGE CLEARED'
                : 'STAGE FAILED'}
          </h2>
          {passed && !isEndless && currentLevel < 5 && (
            <div className="mt-3 py-2 px-4 border border-accent-secondary/40 bg-accent-secondary/5 animate-fade-in">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-accent-secondary rounded-full animate-pulse" />
                <span className="font-cyber text-xs text-accent-secondary tracking-wider">
                  ◈ AI DETECTED ◈
                </span>
                <div className="w-2 h-2 bg-accent-secondary rounded-full animate-pulse" />
              </div>
              <p className="font-cyber text-[11px] text-game-text mt-1 tracking-wider">
                发现新质检员：「{DIFFICULTY_CONFIG[currentLevel + 1]?.name || '???'}」
              </p>
              <p className="font-data text-[10px] text-game-text-dim mt-0.5">
                下一关已解锁，难度系数 ×{DIFFICULTY_CONFIG[currentLevel + 1]?.baselineCoefficient || '?'}
              </p>
            </div>
          )}
          {passed && !isEndless && currentLevel >= 5 && (
            <p className="font-cyber text-xs text-success mt-1 tracking-wider">
              ALL STAGES CLEARED // SEE YOU SPACE COWBOY...
            </p>
          )}
        </div>

        {/* 数据展示 */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between py-2 border-b border-game-border/30">
            <span className="font-data text-sm text-game-text-dim">AVG SCORE</span>
            <span className="font-data text-lg text-game-text font-bold">
              {avgScore}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-game-border/30">
            <span className="font-data text-sm text-game-text-dim">BREAKDOWN</span>
            <span className={`font-data text-lg font-bold ${
              passed ? 'text-success' : 'text-danger'
            }`}>
              {totalValue}<span className={`text-sm ${isHard ? 'text-danger/50' : 'text-game-text-dim'}`}>/{threshold}</span>
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-game-border/30">
            <span className="font-data text-sm text-game-text-dim">ROUNDS</span>
            <span className="font-data text-lg text-game-text font-bold">
              {meter.rounds.length}
            </span>
          </div>
          {!isEndless && (
            <div className="flex items-center justify-between py-2 border-b border-game-border/30">
              <span className="font-data text-sm text-game-text-dim">PASS LINE</span>
              <span className={`font-data text-sm ${isHard ? 'text-danger/70' : 'text-game-text-dim'}`}>
                ≥ {threshold} BREAKDOWN
              </span>
            </div>
          )}
          {!isEndless && bestScores[currentLevel] && bestScores[currentLevel] > 0 && (
            <div className="flex items-center justify-between py-2 border-b border-game-border/30">
              <span className="font-data text-sm text-game-text-dim">BEST RECORD</span>
              <span className="font-data text-lg text-accent font-bold">
                {bestScores[currentLevel]}
              </span>
            </div>
          )}
        </div>

        {/* 加分奖励（通关时显示） */}
        {bonus && bonus.passed && (
          <div className="mb-6 animate-fade-in">
            <div className="flex items-center justify-between py-2 border-b border-game-border/30">
              <button
                type="button"
                onClick={() => {
                  sound.play('ui_button_press');
                  setShowBonusDetails((value) => !value);
                }}
                onMouseEnter={() => sound.play('ui_button_hover')}
                className="group flex items-center gap-2 text-left"
                aria-expanded={showBonusDetails}
              >
                <span className={`font-data text-sm text-game-text-dim transition-transform ${
                  showBonusDetails ? 'rotate-90 text-accent' : ''
                }`}>
                  ▶
                </span>
                <span className="text-base" aria-hidden="true">🏆</span>
                <span className="font-data text-sm text-game-text-dim group-hover:text-accent transition-colors">
                  BONUS SCORE
                </span>
              </button>
              <span className="font-data text-lg text-accent-secondary font-bold">
                +{bonus.kentouEarned} 💰
              </span>
            </div>
            {showBonusDetails && (
              <div className="mt-3 space-y-2 border border-accent/30 bg-accent/5 p-3 text-xs font-data">
                <div className="flex justify-between">
                  <span className="text-game-text-dim">基础分 (BREAKDOWN)</span>
                  <span className="text-game-text">{bonus.baseScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-game-text-dim">轮数奖励 ({bonus.usedRounds}/10轮)</span>
                  <span className="text-success">+{bonus.roundBonus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-game-text-dim">时间奖励 ({bonus.usedSeconds}秒)</span>
                  <span className="text-success">+{bonus.timeBonus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-game-text-dim">通关基础奖励</span>
                  <span className="text-success">+{bonus.clearBonus} 💰</span>
                </div>
                <div className="border-t border-accent/20 pt-2 mt-1 flex justify-between">
                  <span className="text-game-text font-bold">总分</span>
                  <span className="text-accent font-bold text-sm">{bonus.totalBonus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-game-text-dim">超出通关线奖励</span>
                  <span className="text-accent-secondary font-bold">
                    +{bonus.kentouEarned} 💰
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 按钮 */}
        <div className="flex flex-col gap-3">
          {isEndless ? (
            <>
              <button
                onClick={handleEndlessContinue}
                onMouseEnter={() => sound.play('ui_button_hover')}
                className="group cyber-btn w-full"
              >
                <HoverTranslate text="◈ CONTINUE STREAM" hoverText="◈ 继续直播" />
              </button>
              <button
                onClick={() => { sound.play('ui_button_press'); setMode('story'); }}
                onMouseEnter={() => sound.play('ui_button_hover')}
                className="group w-full py-3 border border-game-border text-game-text-dim font-cyber text-xs
                           hover:border-accent hover:text-accent transition-all tracking-wider"
              >
                <HoverTranslate text="SWITCH TO STORY MODE" hoverText="切换故事模式" />
              </button>
              {onGoShop && (
                <button
                  onClick={() => { sound.play('ui_button_press'); onGoShop(); }}
                  onMouseEnter={() => sound.play('ui_button_hover')}
                  className="group w-full py-3 border border-accent-tertiary/60 bg-accent-tertiary/5 text-accent-tertiary font-cyber text-xs
                             hover:bg-accent-tertiary/10 hover:border-accent-tertiary transition-all tracking-wider"
                >
                  <HoverTranslate text="🛒 VISIT SHOP" hoverText="🛒 前往商店" />
                </button>
              )}
            </>
          ) : passed ? (
            <>
              {currentLevel < 5 && unlockedLevels > currentLevel ? (
                <button
                  onClick={handleNextLevel}
                  onMouseEnter={() => sound.play('ui_button_hover')}
                  className="group cyber-btn cyber-btn-pink w-full"
                >
                  <HoverTranslate
                    text={`◈ NEXT STAGE: ${DIFFICULTY_CONFIG[currentLevel + 1]?.name || '??? '}`}
                    hoverText={`◈ 下一关：${DIFFICULTY_CONFIG[currentLevel + 1]?.name || '??? '}`}
                  />
                </button>
              ) : (
                <div className="text-center py-2 border border-success/30 bg-success/5">
                  <p className="font-cyber text-sm text-success tracking-wider">
                    ALL STAGES CLEARED
                  </p>
                </div>
              )}
              <button
                onClick={handleRetry}
                onMouseEnter={() => sound.play('ui_button_hover')}
                className="group w-full py-3 border border-game-border text-game-text-dim font-cyber text-xs
                           hover:border-accent hover:text-accent transition-all tracking-wider"
              >
                <HoverTranslate text="RETRY STAGE" hoverText="重试本关" />
              </button>
              {onGoShop && (
                <button
                  onClick={() => { sound.play('ui_button_press'); onGoShop(); }}
                  onMouseEnter={() => sound.play('ui_button_hover')}
                  className="group w-full py-3 border border-accent-tertiary/60 bg-accent-tertiary/5 text-accent-tertiary font-cyber text-xs
                             hover:bg-accent-tertiary/10 hover:border-accent-tertiary transition-all tracking-wider"
                >
                  <HoverTranslate text="🛒 VISIT SHOP" hoverText="🛒 前往商店" />
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleRetry}
                onMouseEnter={() => sound.play('ui_button_hover')}
                className="group cyber-btn w-full"
              >
                <HoverTranslate text="◈ RETRY STAGE" hoverText="◈ 重试本关" />
              </button>
              <button
                onClick={() => { sound.play('ui_button_press'); setMode('endless', currentLevel); }}
                onMouseEnter={() => sound.play('ui_button_hover')}
                className="group w-full py-3 border border-game-border text-game-text-dim font-cyber text-xs
                           hover:border-accent-tertiary hover:text-accent-tertiary transition-all tracking-wider"
              >
                <HoverTranslate text="PRACTICE IN ENDLESS" hoverText="无尽练习" />
              </button>
              {onGoShop && (
                <button
                  onClick={() => { sound.play('ui_button_press'); onGoShop(); }}
                  onMouseEnter={() => sound.play('ui_button_hover')}
                  className="group w-full py-3 border border-accent-tertiary/60 bg-accent-tertiary/5 text-accent-tertiary font-cyber text-xs
                             hover:bg-accent-tertiary/10 hover:border-accent-tertiary transition-all tracking-wider"
                >
                  <HoverTranslate text="🛒 VISIT SHOP" hoverText="🛒 前往商店" />
                </button>
              )}
              <button
                onClick={() => { sound.play('ui_button_press'); onBackToMenu(); }}
                onMouseEnter={() => sound.play('ui_button_hover')}
                className="group w-full py-3 border border-game-border text-game-text-dim font-cyber text-xs
                           hover:border-danger hover:text-danger transition-all tracking-wider"
              >
                <HoverTranslate text="EXIT TO LOBBY" hoverText="返回大厅" />
              </button>
            </>
          )}
        </div>

        {/* 底部信息 */}
        <div className="mt-6 pt-4 border-t border-game-border flex items-center justify-between">
          <span className="font-data text-[10px] text-game-text-dim tracking-wider">
            SYS: v2.0.77 // CHIRAL: 1.21
          </span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
            <span className="font-data text-[10px] text-success">ONLINE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
