// ============================================================
// 普通观众开场 SuperChat — 每关一条低额开场弹幕
// ============================================================

export interface AudienceOpeningLine {
  /** 观众昵称 */
  viewerName: string;
  /** SuperChat 金额 */
  amount: number;
  /** 开场弹幕正文 */
  text: string;
  /** 攻略小提示 */
  hintTip: string;
}

export const AUDIENCE_OPENING_LINES: Record<number, AudienceOpeningLine> = {
  1: {
    viewerName: '阿乐',
    amount: 6,
    text: '哈哈哈刚进来就感觉要出事',
    hintTip: '阿乐笑点极低，别怕浪费好道具，先拿简单的试水',
  },
  2: {
    viewerName: '小七',
    amount: 12,
    text: '前排看看，这把别又是老套路',
    hintTip: '小七看腻了老套路，把不同道具凑一起玩 combo 才有效',
  },
  3: {
    viewerName: '老陈',
    amount: 30,
    text: '挂着看会儿',
    hintTip: '老陈吃的是连锁反应，搭个触发链让他绷不住',
  },
  4: {
    viewerName: '林老师',
    amount: 66,
    text: '先看结构，不急着评价',
    hintTip: '林老师看重"意外的优雅"，多种物理效果叠加有奇效',
  },
  5: {
    viewerName: '零号评审',
    amount: 99,
    text: '开始吧',
    hintTip: '零号对"精心编排的混乱"敏感，把所有道具串成因果链',
  },
};
