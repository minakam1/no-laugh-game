// ============================================================
// MonitorFrame — CRT 显示器外边框
// 参考：主播女孩重度依赖 / 复古电脑显示器
// ============================================================

import { type ReactNode } from 'react';

interface MonitorFrameProps {
  children: ReactNode;
  className?: string;
}

export function MonitorFrame({ children, className = '' }: MonitorFrameProps) {
  return (
    <div className={`monitor-frame ${className}`}>
      {/* 显示器外壳 */}
      <div className="monitor-bezel">
        {/* 顶部品牌条 */}
        <div className="monitor-brand-bar">
          <div className="monitor-brand-left">
            <span className="monitor-logo">◈</span>
            <span className="monitor-brand-text">NEURO-LINK</span>
          </div>
          <div className="monitor-brand-right">
            <span className="monitor-model">MODEL: NL-9000</span>
          </div>
        </div>

        {/* 屏幕区域 */}
        <div className="monitor-screen-area">
          {/* 屏幕内边框（显像管边缘） */}
          <div className="monitor-crt-edge">
            {/* 屏幕内容 */}
            <div className="monitor-screen-content">
              {children}
            </div>

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
            <div className="monitor-deco-btn" />
            <div className="monitor-deco-btn monitor-deco-btn-active" />
          </div>

          <div className="monitor-control-right">
            <span className="monitor-serial">S/N: 8X-7729-β</span>
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
