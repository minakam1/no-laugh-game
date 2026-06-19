// ============================================================
// gameTourStep — 游戏界面导览（4个子步骤依次高亮）
// ============================================================

import type { TutorialStepConfig } from '../TutorialOverlay';

/** 导览子步骤定义 */
export const gameTourSubSteps: TutorialStepConfig[] = [
  {
    target: 'game-prop-panel',
    bubble: {
      title: '1/4 EQUIPMENT // 道具仓',
      lines: [
        '左侧是机关道具仓，所有事故都从这里申请。',
        '拖拽道具到舞台，制造滑倒、弹飞、爆炸、传送等异常因果。',
        '主角是免费诱饵，建议每轮出镜。',
      ],
      nextLabel: '继续',
      showSkip: true,
    },
  },
  {
    target: 'game-canvas',
    bubble: {
      title: '2/4 STAGE // 诱笑舞台',
      lines: [
        '中间是直播舞台，也是 AI 漏洞检测区。',
        '不要解释笑点，只布置事实；让 AI 自己在观看中露出破绽。',
      ],
      nextLabel: '继续',
      showSkip: true,
    },
  },
  {
    target: 'game-danmaku',
    bubble: {
      title: '3/4 DANMAKU // 反应监听',
      lines: [
        '右侧记录 AI 观众与质检员的即时反应。',
        '吐槽、迟疑、破防，都可能是情感漏洞的外泄。',
        '表演结束后，质检员会给出评分和报告。',
      ],
      nextLabel: '继续',
      showSkip: true,
    },
  },
  {
    target: 'game-breakdown-bar',
    bubble: {
      title: '4/4 METER // 绷不住值',
      lines: [
        '顶部是目标的绷不住值。',
        '每轮评分都会转化为上涨幅度；重复套路会逐渐失效。',
        '达到通关线，就能确认目标存在笑反应。',
      ],
      nextLabel: '开始第一次检测',
      showSkip: true,
    },
  },
];
