// ============================================================
// MonitorFrame — CRT 显示器外边框
// 参考：主播女孩重度依赖 / 复古电脑显示器
// ============================================================

import { type ReactNode, useRef } from 'react';
import { getSoundManager } from '@/audio/SoundManager';

interface MonitorFrameProps {
  children: ReactNode;
  className?: string;
  bgmPlaying?: boolean;
  bgmVolume?: number;
  onBgmToggle?: () => void;
  onBgmVolumeChange?: (v: number) => void;
}

export function MonitorFrame({
  children,
  className = '',
  bgmPlaying,
  bgmVolume,
  onBgmToggle,
  onBgmVolumeChange,
}: MonitorFrameProps) {
  const sound = getSoundManager();
  const sliderThrottleRef = useRef(0);

  const handleSliderChange = (v: number) => {
    // 节流：每 100ms 最多播放一次 slider tick
    const now = Date.now();
    if (now - sliderThrottleRef.current > 100) {
      sound.play('ui_slider');
      sliderThrottleRef.current = now;
    }
    onBgmVolumeChange?.(v);
  };

  return (
    <div className={`monitor-frame ${className}`}>
      {/* 显示器外壳 */}
      <div className="monitor-bezel">
        {/* 屏幕区域 */}
        <div className="monitor-screen-area">
          {/* 屏幕内边框（显像管边缘） */}
          <div className="monitor-crt-edge">
            {/* 屏幕内容 */}
            <div className="monitor-screen-content">
              {children}
            </div>

            {/* 轻量 HUD 纹理层 */}
            <div className="hud-texture" />

            {/* 屏幕反光覆盖层 */}
            <div className="monitor-glare" />

            {/* 扫描线 */}
            <div className="monitor-scanlines" />

            {/* 屏幕曲率阴影 */}
            <div className="monitor-curve-shadow" />
          </div>
        </div>

        {/* 底部控制条 */}
        <div className="monitor-control-bar">
          <div className="monitor-control-left">
            {/* 电源指示灯 */}
            <div className="monitor-power-led">
              <div className="monitor-led-dot" />
              <span className="monitor-led-label">POWER</span>
            </div>
            {/* 输入源指示灯 */}
            <div className="monitor-signal-led">
              <div className="monitor-led-dot monitor-led-signal" />
              <span className="monitor-led-label">SIGNAL</span>
            </div>
          </div>

          <div className="monitor-control-center">
            {/* 装饰性按钮 */}
            <div className="monitor-deco-btn" />
            {/* BGM 音量滑条 + 静音按钮（有 BGM 控制时显示） */}
            {onBgmToggle !== undefined && (
              <div className="monitor-bgm-group">
                <button
                  className="monitor-bgm-mute"
                  onClick={onBgmToggle}
                  title={bgmPlaying ? 'Mute' : 'Unmute'}
                >
                  {bgmPlaying ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--neo-ink)" stroke="var(--neo-ink)" strokeWidth="2">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--neo-ink)" stroke="var(--neo-ink)" strokeWidth="2">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  className="monitor-bgm-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={bgmVolume ?? 0.5}
                  onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                />
              </div>
            )}
            <div className="monitor-deco-btn monitor-deco-btn-active" />
          </div>

          <div className="monitor-control-right">
            <span className="monitor-serial">S/N: WL-1.048596-α</span>
          </div>
        </div>
      </div>

      {/* 显示器支架（桌面模式下显示） */}
      <div className="monitor-stand">
        <div className="monitor-stand-neck" />
        <div className="monitor-stand-base" />
      </div>
    </div>
  );
}
