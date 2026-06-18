// ============================================================
// menuStep — 模式选择引导步骤
// ============================================================

import type { TutorialStepConfig } from '../TutorialOverlay';

export const menuStep: TutorialStepConfig = {
  target: 'menu-story-start',
  waitForAction: true,  // 等用户点击开始游戏后自动推进
  bubble: {
    title: 'CHANNEL SELECT // 频道选择',
    lines: [
      '📋 故事模式：5个递进关卡，从易到难。',
      '无尽模式：不限回合，冲击最高分。',
      '新手推荐从故事模式 STAGE 01 开始。',
      '点击下方「从第一关开始」出发！',
    ],
    nextLabel: '出发',
    showSkip: true,
  },
};
