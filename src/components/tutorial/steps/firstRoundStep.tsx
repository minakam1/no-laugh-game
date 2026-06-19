// ============================================================
// firstRoundStep — 首回合交互引导（3个子步骤）
// ============================================================

import type { TutorialStepConfig } from '../TutorialOverlay';

export const firstRoundSubSteps: TutorialStepConfig[] = [
  {
    target: 'game-prop-banana',
    waitForAction: true,  // 等用户拖入香蕉皮和主角后自动推进
    bubble: {
      title: '1/3 TRAP // 部署陷阱',
      lines: [
        '找到「香蕉皮」，花3头肯部署到舞台中央。',
        '再把「主角」放到附近。',
        '经典陷阱虽然古老，但 AI 最容易轻视古老本能。',
      ],
      nextLabel: '放好了',
      showSkip: true,
    },
  },
  {
    target: 'game-perform-btn',
    waitForAction: true,  // 等用户点击开始表演后自动推进
    bubble: {
      title: '2/3 ACTION // 开始表演',
      lines: [
        '点击画布底部的「开始表演」，直播切入正式检测。',
        '主角踩上香蕉皮，失控、滑倒。',
        '现在，把画面交给质检员。',
      ],
      nextLabel: '表演中……',
      showSkip: true,
    },
  },
  {
    target: 'game-danmaku',
    waitForAction: true,  // 等表演结束出结果后自动推进
    bubble: {
      title: '3/3 REACTION // 观察反应',
      lines: [
        '盯紧右侧反应流。',
        '如果 AI 开始解释自己为什么没笑，通常说明它已经危险。',
        '评分会写入顶部绷不住值。',
      ],
      nextLabel: '查看评分',
      showSkip: true,
    },
  },
];
