// ============================================================
// menuStep — 模式选择引导步骤
// ============================================================

import type { TutorialStepConfig } from '../TutorialOverlay';

export const menuStep: TutorialStepConfig = {
  target: 'menu-story-start',
  waitForAction: true,  // 等用户点击开始游戏后自动推进
  bubble: {
    title: 'CHANNEL SELECT // 选择目标',
    lines: [
      '故事模式是机关行动线，从低敏感目标，一路查到会伪装的冷面AI。',
      '无尽模式来狩猎所有的缺陷智能体。',
      '首次行动从 STAGE 01 开始，目标：快乐小狗。',
      '点击「从第一关开始」，直播会自动开始。',
    ],
    nextLabel: '开始推流',
    showSkip: true,
  },
};
