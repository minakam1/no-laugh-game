// ============================================================
// configStep — API配置引导步骤
// ============================================================

import type { TutorialStepConfig } from '../TutorialOverlay';

export const configStep: TutorialStepConfig = {
  target: 'config-quick-btns',
  waitForAction: true,  // 等用户确认配置后自动推进
  bubble: {
    title: 'SIGNAL SETUP // 接入直播网络',
    lines: [
      '先接通AI信号源，否则观众和质检员无法上线。',
      '选择填写模型信息，系统会把它伪装成直播质检席。',
      '填好后点击「测试信号」；只要模型回应，猎场就开门。',
    ],
    nextLabel: '了解，去接入',
    showSkip: true,
  },
};
