// ============================================================
// BreakdownBar — 绷不住值霓虹能量条（赛博朋克直播OBS风格）
// ============================================================

interface BreakdownBarProps {
  value: number;
  level: number;
  round: number;
  maxRounds?: number;
  mode?: string;
  difficulty?: 'normal' | 'hard';
  passThreshold?: number;
  onForceSettle?: () => void;
}

export function BreakdownBar({ value, level, round, maxRounds = 10, mode = 'story', difficulty = 'normal', passThreshold = 30, onForceSettle }: BreakdownBarProps) {
  const threshold = passThreshold;
  // 进度条以过关阈值为 100%
  const pct = Math.min(100, (value / threshold) * 100);
  const isEndless = mode === 'endless';
  const isHard = difficulty === 'hard';

  // 根据绷不住值决定颜色（基于阈值比例）
  const getBarColor = (v: number) => {
    if (v >= threshold) return 'from-danger via-accent-secondary to-warning';
    if (v >= threshold * 0.7) return 'from-accent-secondary to-warning';
    if (v >= threshold * 0.5) return 'from-accent to-accent-secondary';
    return 'from-accent to-accent-tertiary';
  };

  const barGradient = getBarColor(value);

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      {/* 状态标签 */}
      <div className="shrink-0">
        <span className="font-cyber text-[10px] text-game-text-dim tracking-wider block">
          {isEndless ? 'ENDLESS' : `ROUND`}
        </span>
        <span className={`font-data text-sm font-bold ${isHard ? 'text-danger' : 'text-accent'}`}>
          {isEndless ? `LV${level}` : `${round}/${maxRounds}`}
        </span>
      </div>

      {/* 能量条容器 */}
      <div className="flex-1 relative">
        {/* 背景轨道 */}
        <div className={`h-5 border relative overflow-hidden ${isHard ? 'bg-danger/5 border-danger/30' : 'bg-game-bg border-game-border'}`}>
          {/* 刻度线 */}
          <div className="absolute inset-0 flex justify-between px-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="w-px h-full bg-game-border/50" />
            ))}
          </div>

          {/* 填充条 */}
          <div
            className="h-full transition-all duration-500 ease-out relative"
            style={{ width: `${pct}%` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-r ${barGradient}`} />
            {/* 高光 */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/40" />
            {/* 脉冲发光 */}
            <div
              className="absolute inset-0 animate-meter-pulse"
              style={{
                boxShadow: value >= threshold
                  ? 'inset 0 0 10px rgba(255,0,160,0.5), 0 0 15px rgba(255,0,160,0.3)'
                  : 'inset 0 0 6px rgba(0,240,255,0.3)'
              }}
            />
          </div>
        </div>

        {/* 刻度标记 */}
        <div className="flex justify-between mt-0.5">
          <span className="font-data text-[9px] text-game-text-dim">0</span>
          <span className="font-data text-[9px] text-game-text-dim">{Math.round(threshold * 0.5)}</span>
          <span className={`font-data text-[9px] ${isHard ? 'text-danger/70' : 'text-game-text-dim'}`}>{threshold}</span>
        </div>
      </div>

      {/* 数值显示 */}
      <div className="shrink-0 text-right min-w-[70px]">
        <span className={`font-cyber text-[10px] tracking-wider block ${isHard ? 'text-danger/70' : 'text-game-text-dim'}`}>
          BREAKDOWN
        </span>
        <span className={`font-data text-lg font-bold ${
          value >= threshold ? 'text-danger' : value >= threshold * 0.7 ? 'text-accent-secondary' : 'text-accent'
        }`}>
          {Math.round(value)}
          <span className={`text-xs ${isHard ? 'text-danger/50' : 'text-game-text-dim'}`}>/{threshold}</span>
        </span>
      </div>

      {/* 立即执行按钮：分数达标时显示 */}
      {!isEndless && value >= threshold && onForceSettle && (
        <button
          onClick={onForceSettle}
          className={`shrink-0 px-5 py-3 border-2 font-cyber text-sm tracking-widest animate-pulse
                     hover:scale-105 active:scale-95 transition-all rounded shadow-lg
                     ${isHard
                       ? 'border-danger bg-danger/20 text-danger hover:bg-danger/35 hover:border-danger shadow-danger/50'
                       : 'border-danger bg-danger/20 text-danger hover:bg-danger/35 hover:border-danger shadow-danger/30'
                     }`}
          style={{ textShadow: '0 0 8px rgba(255,0,80,0.6)' }}
        >
          ◈ 立即执行 ◈
        </button>
      )}
    </div>
  );
}
