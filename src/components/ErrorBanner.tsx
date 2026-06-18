// ============================================================
// ErrorBanner — 错误提示横幅（赛博朋克风格）
// ============================================================

interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div className="mx-4 mt-2 px-4 py-2 border border-danger/40 bg-danger/5 flex items-center justify-between animate-fade-in relative overflow-hidden">
      {/* 左侧危险指示 */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-danger rounded-full animate-pulse" />
        <span className="font-cyber text-[10px] text-danger tracking-wider">ERROR</span>
        <span className="text-sm text-danger font-data">{message}</span>
      </div>
      <button
        onClick={onDismiss}
        className="ml-3 text-danger/70 hover:text-danger text-lg leading-none font-cyber"
      >
        ✕
      </button>
      {/* 底部危险条 */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-danger/30" />
    </div>
  );
}
