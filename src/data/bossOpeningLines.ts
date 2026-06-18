// ============================================================
// Boss 开场白 — 每关质检员专属 SuperChat 留言（精简版）
// ============================================================

export interface BossOpeningLine {
  /** 质检员昵称 */
  judgeName: string;
  /** SuperChat 金额 */
  amount: number;
  /** 开场白正文 */
  text: string;
  /** 攻略小提示 */
  hintTip: string;
}

export const BOSS_OPENING_LINES: Record<number, BossOpeningLine> = {
  1: {
    judgeName: '阿乐',
    amount: 888,
    text: '嘿嘿～新人来了！听说有人专挑软柿子捏，来吧来吧～',
    hintTip: '阿乐笑点极低，别怕浪费好道具，先拿简单的试水',
  },
  2: {
    judgeName: '小七',
    amount: 1666,
    text: '哟～新关卡！小七我刷遍全网名场面，可别拿老梗糊弄我啊',
    hintTip: '小七看腻了老套路，把不同道具凑一起玩 combo 才有效',
  },
  3: {
    judgeName: '老陈',
    amount: 3333,
    text: '（叼着烟）…老观众了，一般的花活我都懒得打字',
    hintTip: '老陈吃的是连锁反应，搭个触发链让他绷不住',
  },
  4: {
    judgeName: '林老师',
    amount: 6666,
    text: '真正的幽默在于意料之外的失控。请开始你们的表演',
    hintTip: '林老师看重"意外的优雅"，多种物理效果叠加有奇效',
  },
  5: {
    judgeName: '零号评审',
    amount: 9999,
    text: '…在我面前已有 847 位挑战者失败。希望你们是例外',
    hintTip: '零号对"精心编排的混乱"敏感，把所有道具串成因果链',
  },
};
