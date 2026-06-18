// ============================================================
// resultStep — 结算引导步骤
// ============================================================

import type { TutorialStepConfig } from '../TutorialOverlay';

export const resultStep: TutorialStepConfig = {
  target: 'result-modal',
  bubble: {
    title: 'SHOW RESULT // 节目报告',
    lines: [
      '📋 一次测试完成！来看看本轮表现。',
      '绷不住值累加到通关线就能过关，进入下一关。',
      '💡 绷不住值达标后，点击绷不住值旁的「◈ 立即执行 ◈」可提前结束，无需用完所有回合。',
      '🔒 通过第一关解锁商店。通过全部关卡解锁困难模式。',
    ],
    nextLabel: '挑战完成！',
    showSkip: true,
  },
};
