// ============================================================
// BreakdownBar — 绷不住值霓虹能量条（赛博朋克直播OBS风格）
// ============================================================

interface BreakdownBarProps {
  value: number;
  level: number;
  round: number;
  maxRounds?: number;
  mode?: string;
}

export function BreakdownBar({ value, level, round, maxRounds = 10, mode = 'story' }: BreakdownBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  const isEndless = mode === 'endless';

  // 根据绷不住值决定颜色
  const getBarColor = (v: number) => {
    if (v >= 80) return 'from-danger via-accent-secondary to-warning';
    if (v >= 50) return 'from-accent-secondary to-warning';
    if (v >= 30) return 'from-accent to-accent-secondary';
    return 'from-accent to-accent-tertiary';
  };

  const barGradient = getBarColor(pct);

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      {/* 状态标签 */}
      <div className="shrink-0">
        <span className="font-cyber text-[10px] text-game-text-dim tracking-wider block">
          {isEndless ? 'ENDLESS' : `ROUND`}
        </span>
        <span className="font-data text-sm text-accent font-bold">
          {isEndless ? `LV${level}` : `${round}/${maxRounds}`}
        </span>
      </div>

      {/* 能量条容器 */}
      <div className="flex-1 relative">
        {/* 背景轨道 */}
        <div className="h-5 bg-game-bg border border-game-border relative overflow-hidden">
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
                boxShadow: pct > 50
                  ? 'inset 0 0 10px rgba(255,0,160,0.5), 0 0 15px rgba(255,0,160,0.3)'
                  : 'inset 0 0 6px rgba(0,240,255,0.3)'
              }}
            />
          </div>
        </div>

        {/* 百分比标记 */}
        <div className="flex justify-between mt-0.5">
          <span className="font-data text-[9px] text-game-text-dim">0%</span>
          <span className="font-data text-[9px] text-game-text-dim">50%</span>
          <span className="font-data text-[9px] text-game-text-dim">100%</span>
        </div>
      </div>

      {/* 数值显示 */}
      <div className="shrink-0 text-right min-w-[70px]">
        <span className="font-cyber text-[10px] text-game-text-dim tracking-wider block">
          BREAKDOWN
        </span>
        <span className={`font-data text-lg font-bold ${
          pct >= 80 ? 'text-danger' : pct >= 50 ? 'text-accent-secondary' : 'text-accent'
        }`}>
          {Math.round(value)}
          <span className="text-xs text-game-text-dim">/100</span>
        </span>
      </div>
    </div>
  );
}
