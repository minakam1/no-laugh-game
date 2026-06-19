// ============================================================
// resultStep — 结算引导步骤
// ============================================================

import type { TutorialStepConfig } from '../TutorialOverlay';

export const resultStep: TutorialStepConfig = {
  target: 'result-modal',
  bubble: {
    title: 'SHOW RESULT // 检测报告',
    lines: [
      '本轮检测报告已生成。',
      '绷不住值达标就进入下一目标；不足就继续布置狠货。',
      '达标后可点击「立即执行」提前收网。',
      '通关第一关解锁商店；完成全部目标后开放困难模式。',
    ],
    nextLabel: '完成检测',
    showSkip: true,
  },
};
