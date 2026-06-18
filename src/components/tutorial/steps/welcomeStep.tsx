// ============================================================
// welcomeStep — 欢迎步骤配置（黑色幽默世界观）
// ============================================================

import type { TutorialStepConfig } from '../TutorialOverlay';

export const welcomeStep: TutorialStepConfig = {
  target: undefined,
  bubble: {
    title: 'LIVE // AI笑TV',
    lines: [
      '🎬 挑战者，欢迎来到 AI笑TV！',
      '规则：搭建滑稽场景 → 表演给 AI 质检员看 → 逗笑它们就能得分。',
      '绷不住值越高 = 笑得越厉害。通不过测试，将被淘汰。',
      '10轮挑战，积累30分即可通关！',
    ],
    nextLabel: '开始挑战',
    showSkip: true,
  },
};
