// ============================================================
// configStep — API配置引导步骤
// ============================================================

import type { TutorialStepConfig } from '../TutorialOverlay';

export const configStep: TutorialStepConfig = {
  target: 'config-quick-btns',
  waitForAction: true,  // 等用户确认配置后自动推进
  bubble: {
    title: 'SIGNAL SETUP // 信号校准',
    lines: [
      '📡 先接通 AI 信号源，AI 质检员才能上线。',
      '点击上方按钮快速填入推荐配置。',
      '「本地模型」无需 API Key，「深度求索」便宜好用。',
      '填好后点击「测试信号」验证连通。',
    ],
    nextLabel: '了解，去配置',
    showSkip: true,
  },
};
