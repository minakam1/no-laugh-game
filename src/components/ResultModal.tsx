// ============================================================
// ResultModal — 通关/失败结算弹窗（赛博朋克直播结算面板）
// ============================================================

import { useGameStore, DIFFICULTY_CONFIG, PASS_THRESHOLD } from '@/store/gameStore';

interface ResultModalProps {
  onBackToMenu: () => void;
}

export function ResultModal({ onBackToMenu }: ResultModalProps) {
  const phase = useGameStore((s) => s.phase);
  const meter = useGameStore((s) => s.meter);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const mode = useGameStore((s) => s.mode);
  const unlockedLevels = useGameStore((s) => s.unlockedLevels);
  const bestScores = useGameStore((s) => s.bestScores);
  const nextLevel = useGameStore((s) => s.nextLevel);
  const reset = useGameStore((s) => s.reset);
  const setMode = useGameStore((s) => s.setMode);

  if (phase !== 'result') return null;

  const totalValue = Math.round(meter.value);
  const passed = totalValue >= PASS_THRESHOLD;
  const isEndless = mode === 'endless';

  const avgScore = meter.rounds.length > 0
    ? (meter.rounds.reduce((sum, r) => sum + r.funnyScore, 0) / meter.rounds.length).toFixed(1)
    : '0.0';

  const handleNextLevel = () => {
    nextLevel();
  };

  const handleRetry = () => {
    reset();
  };

  const handleEndlessContinue = () => {
    reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      {/* 扫描线 */}
      <div className="absolute inset-0 scanlines pointer-events-none" />

      <div className="cyber-panel cyber-corner max-w-md w-full mx-4 p-8 animate-slide-up relative z-10">
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
          {passed && !isEndless && currentLevel >= 5 && (
            <p className="font-cyber text-xs text-success mt-1 tracking-wider">
              ALL STAGES CLEARED // MASTER ACHIEVED
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
              {totalValue}<span className="text-sm text-game-text-dim">/100</span>
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
              <span className="font-data text-sm text-game-text-dim">
                ≥ {PASS_THRESHOLD} BREAKDOWN
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

        {/* 按钮 */}
        <div className="flex flex-col gap-3">
          {isEndless ? (
            <>
              <button
                onClick={handleEndlessContinue}
                className="cyber-btn w-full"
              >
                ◈ CONTINUE STREAM
              </button>
              <button
                onClick={() => setMode('story')}
                className="w-full py-3 border border-game-border text-game-text-dim font-cyber text-xs
                           hover:border-accent hover:text-accent transition-all tracking-wider"
              >
                SWITCH TO STORY MODE
              </button>
            </>
          ) : passed ? (
            <>
              {currentLevel < 5 && unlockedLevels > currentLevel ? (
                <button
                  onClick={handleNextLevel}
                  className="cyber-btn cyber-btn-pink w-full"
                >
                  ◈ NEXT STAGE: {DIFFICULTY_CONFIG[currentLevel + 1]?.name || '??? '}
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
                className="w-full py-3 border border-game-border text-game-text-dim font-cyber text-xs
                           hover:border-accent hover:text-accent transition-all tracking-wider"
              >
                RETRY STAGE
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleRetry}
                className="cyber-btn w-full"
              >
                ◈ RETRY STAGE
              </button>
              <button
                onClick={() => setMode('endless', currentLevel)}
                className="w-full py-3 border border-game-border text-game-text-dim font-cyber text-xs
                           hover:border-accent-tertiary hover:text-accent-tertiary transition-all tracking-wider"
              >
                PRACTICE IN ENDLESS
              </button>
              <button
                onClick={onBackToMenu}
                className="w-full py-3 border border-game-border text-game-text-dim font-cyber text-xs
                           hover:border-danger hover:text-danger transition-all tracking-wider"
              >
                EXIT TO LOBBY
              </button>
            </>
          )}
        </div>

        {/* 底部信息 */}
        <div className="mt-6 pt-4 border-t border-game-border flex items-center justify-between">
          <span className="font-data text-[10px] text-game-text-dim tracking-wider">
            SYS: v2.0.77
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
