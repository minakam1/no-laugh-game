// ============================================================
// AICommentCard — 裁判评语卡片（赛博朋克直播解说条风格）
// ============================================================

import { useGameStore } from '@/store/gameStore';
import { DIFFICULTY_CONFIG } from '@/store/gameStore';

export function AICommentCard() {
  const rounds = useGameStore((s) => s.meter.rounds);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const judgeDismissedRound = useGameStore((s) => s.judgeDismissedRound);
  const lastRound = rounds[rounds.length - 1];

  // 如果用户已关闭裁判卡片（judgeDismissedRound >= rounds.length），显示等待状态
  if (!lastRound || judgeDismissedRound >= rounds.length) {
    return (
      <div className="px-4 py-3 border-t border-game-border bg-game-surface/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-accent/30 bg-accent/10 flex items-center justify-center shrink-0">
            <span className="font-cyber text-xs text-accent">AI</span>
          </div>
          <div>
            <span className="font-cyber text-[10px] text-game-text-dim tracking-wider block">
              REFEREE // {DIFFICULTY_CONFIG[currentLevel]?.name || 'UNKNOWN'}
            </span>
            <p className="text-sm text-game-text-dim font-data">
              [ 等待表演信号输入... ]
            </p>
          </div>
        </div>
      </div>
    );
  }

  const config = DIFFICULTY_CONFIG[currentLevel];

  return (
    <div className="px-4 py-3 border-t border-game-border bg-game-surface/30 animate-fade-in">
      <div className="flex items-start gap-3">
        {/* AI 裁判头像 */}
        <div className="w-8 h-8 border border-accent-secondary/40 bg-accent-secondary/10 flex items-center justify-center shrink-0 relative">
          <span className="font-cyber text-xs text-accent-secondary">AI</span>
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-accent-secondary rounded-full animate-pulse" />
        </div>

        {/* 解说内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-cyber text-[10px] text-accent-secondary tracking-wider">
              REFEREE // {config?.name || 'UNKNOWN'}
            </span>
            <span className="font-data text-[10px] text-accent">
              +{lastRound.actualGain.toFixed(1)}
            </span>
            {lastRound.decayFactor < 1 && (
              <span className="font-data text-[10px] text-game-text-dim">
                (DECAY ×{lastRound.decayFactor.toFixed(2)})
              </span>
            )}
          </div>
          <p className="text-sm text-game-text leading-relaxed font-data">
            {lastRound.reason || '裁判沉默不语'}
          </p>
        </div>
      </div>

      {/* 底部数据条 */}
      <div className="mt-2 flex items-center gap-4 pt-2 border-t border-game-border/30">
        <div className="flex items-center gap-1">
          <span className="font-data text-[9px] text-game-text-dim">SCORE</span>
          <span className="font-data text-xs text-accent font-bold">{lastRound.funnyScore}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-data text-[9px] text-game-text-dim">GAIN</span>
          <span className="font-data text-xs text-success">+{lastRound.actualGain.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-data text-[9px] text-game-text-dim">ROUND</span>
          <span className="font-data text-xs text-game-text">#{rounds.length}</span>
        </div>
      </div>

      {lastRound.motionSummary && (
        <div className="mt-2 pt-2 border-t border-game-border/30">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-cyber text-[9px] text-accent tracking-wider">
              MOTION CHAIN
            </span>
            {lastRound.motionSummary.chainLabels.length > 0 && (
              <span className="font-data text-[11px] text-game-text">
                {lastRound.motionSummary.chainLabels.join(' -> ')}
              </span>
            )}
            <span className="font-data text-[10px] text-game-text-dim">
              moved {lastRound.motionSummary.movedCount} / effects {lastRound.motionSummary.effectCount}
            </span>
          </div>
          <p className="mt-1 font-data text-[11px] text-game-text-dim leading-relaxed">
            {lastRound.motionSummary.text}
          </p>
        </div>
      )}
    </div>
  );
}
