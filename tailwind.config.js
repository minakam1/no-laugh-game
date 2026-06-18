/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'game-bg': 'var(--game-bg)',
        'game-surface': 'var(--game-surface)',
        'game-surface-glass': 'var(--game-surface-glass)',
        'game-border': 'var(--game-border)',
        'game-border-bright': 'var(--game-border-bright)',
        'game-text': 'var(--game-text)',
        'game-text-dim': 'var(--game-text-dim)',
        'game-text-bright': 'var(--game-text-bright)',
        'accent': 'var(--accent)',
        'accent-glow': 'var(--accent-glow)',
        'accent-secondary': 'var(--accent-secondary)',
        'accent-secondary-glow': 'var(--accent-secondary-glow)',
        'accent-tertiary': 'var(--accent-tertiary)',
        'accent-tertiary-glow': 'var(--accent-tertiary-glow)',
        'meter-fill': 'var(--meter-fill)',
        'meter-bg': 'var(--meter-bg)',
        'danmaku-bg': 'var(--danmaku-bg)',
        'danger': 'var(--danger)',
        'danger-glow': 'var(--danger-glow)',
        'success': 'var(--success)',
        'success-glow': 'var(--success-glow)',
        'warning': 'var(--warning)',
        'live-badge': 'var(--live-badge)',
        'live-badge-glow': 'var(--live-badge-glow)',
        'viewer-count': 'var(--viewer-count)',
      },
      fontFamily: {
        cyber: ['"Orbitron"', '"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        data: ['"Rajdhani"', '"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'monospace'],
        game: ['"Rajdhani"', '"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Noto Sans SC"', 'monospace'],
      },
      animation: {
        'danmaku-scroll': 'danmaku 0.5s ease-out forwards',
        'meter-pulse': 'meterPulse 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'live-pulse': 'livePulse 2s ease-in-out infinite',
        'neon-flicker': 'neonFlicker 3s ease-in-out infinite',
        'border-glow': 'borderGlow 3s ease-in-out infinite',
        'scan': 'scanline 4s linear infinite',
      },
      keyframes: {
        danmaku: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        meterPulse: {
          '0%, 100%': { boxShadow: '0 0 8px var(--accent-glow), 0 0 16px var(--accent-glow)' },
          '50%': { boxShadow: '0 0 16px var(--accent-glow), 0 0 32px var(--accent-glow)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        livePulse: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 8px var(--live-badge-glow)' },
          '50%': { opacity: '0.7', boxShadow: '0 0 16px var(--live-badge-glow)' },
        },
        neonFlicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        borderGlow: {
          '0%, 100%': { borderColor: 'var(--accent)', boxShadow: '0 0 4px var(--accent-glow)' },
          '50%': { borderColor: 'var(--accent-secondary)', boxShadow: '0 0 8px var(--accent-secondary-glow)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
};
