// ============================================================
// welcomeStep — 欢迎步骤配置（黑色幽默世界观）
// ============================================================

import type { TutorialStepConfig } from '../TutorialOverlay';

export const welcomeStep: TutorialStepConfig = {
  target: undefined,
  bubble: {
    title: 'MISSION BRIEF // AI笑TV',
    lines: [
      '挑战者，编号已录入。AI笑TV 的直播信号即将接管全城。',
      '你的任务是取悦观众，诱发 AI 的情感漏洞：笑。',
      '搭建直播场景，质检员给出反应；绷不住值越高，嫌疑越大。',
      '10轮内累计30点绷不住值，目标智能体就会被锁定。',
    ],
    nextLabel: '接受任务',
    showSkip: true,
  },
};
