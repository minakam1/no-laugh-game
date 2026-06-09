// ============================================================
// BreakdownBar — 绷不住值霓虹能量条（赛博朋克直播OBS风格）
// ============================================================

interface BreakdownBarProps {
  value: number;
  level: number;
  round: number;
  maxRounds?: number;
  mode?: string;
  onForceSettle?: () => void;
}

export function BreakdownBar({ value, level, round, maxRounds = 10, mode = 'story', onForceSettle }: BreakdownBarProps) {
  const PASS_THRESHOLD = 30;
  // 进度条以过关阈值 30 为 100%，超出部分也显示满条
  const pct = Math.min(100, (value / PASS_THRESHOLD) * 100);
  const isEndless = mode === 'endless';

  // 根据绷不住值决定颜色（基于30分过关线）
  const getBarColor = (v: number) => {
    if (v >= PASS_THRESHOLD) return 'from-danger via-accent-secondary to-warning';
    if (v >= 20) return 'from-accent-secondary to-warning';
    if (v >= 15) return 'from-accent to-accent-secondary';
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
                boxShadow: value >= PASS_THRESHOLD
                  ? 'inset 0 0 10px rgba(255,0,160,0.5), 0 0 15px rgba(255,0,160,0.3)'
                  : 'inset 0 0 6px rgba(0,240,255,0.3)'
              }}
            />
          </div>
        </div>

        {/* 百分比标记 */}
        <div className="flex justify-between mt-0.5">
          <span className="font-data text-[9px] text-game-text-dim">0</span>
          <span className="font-data text-[9px] text-game-text-dim">15</span>
          <span className="font-data text-[9px] text-game-text-dim">30</span>
        </div>
      </div>

      {/* 数值显示 */}
      <div className="shrink-0 text-right min-w-[70px]">
        <span className="font-cyber text-[10px] text-game-text-dim tracking-wider block">
          BREAKDOWN
        </span>
        <span className={`font-data text-lg font-bold ${
          value >= PASS_THRESHOLD ? 'text-danger' : value >= 20 ? 'text-accent-secondary' : 'text-accent'
        }`}>
          {Math.round(value)}
          <span className="text-xs text-game-text-dim">/30</span>
        </span>
      </div>

      {/* 立即执行按钮：分数达标时显示 */}
      {!isEndless && value >= PASS_THRESHOLD && onForceSettle && (
        <button
          onClick={onForceSettle}
          className="shrink-0 px-3 py-1.5 border border-danger/50 bg-danger/10 text-danger
                     font-cyber text-[10px] tracking-wider animate-pulse
                     hover:bg-danger/20 hover:border-danger transition-all"
        >
          ◈ 立即执行
        </button>
      )}
    </div>
  );
}
