// ============================================================
// 成就系统 — 赛博直播间整活成就（有梗有趣）
// ============================================================

export type AchievementId =
  // === 新手入门 ===
  | 'first_blood'        // 初次表演
  | 'first_laugh'        // 第一次让AI笑
  | 'prop_master'         // 用过10种不同道具
  // === 高分操作 ===
  | 'perfect_10'         // 单次满分
  | 'speedrun_god'       // 3回合内通关
  | 'no_banana'          // 不用香蕉皮通关
  | 'all_explosive'      // 全爆炸道具通关
  // === 物理学家 ===
  | 'chain_3'            // 3个道具连锁反应
  | 'cliff_hanger'       // 悬崖模式通关
  | 'rapids_survivor'    // 猛龙过江通关
  | 'wind_rider'         // 暴风模式通关
  | 'dark_clear'         // 至暗时刻通关
  // === 整活 ===
  | 'kentou_million'     // 肯头破千
  | 'banana_only'        // 只用香蕉皮过一关
  | 'npc_solo'           // 只放主角没放别的
  | 'big_spender'        // 一回合花20+头肯
  | 'collector'          // 买完所有商店道具
  // === 弹幕互动 ===
  | 'danmaku_king'       // 20条AI弹幕
  | 'silent_all'         // 全沉默（0分回合）
  | 'triple_0'           // 连续3回合得0分
  | 'comeback'           // 0分后下一回合8+
  | 'first_danmaku'      // 第一次发快捷弹幕
  | 'danmaku_spammer'    // 发10条快捷弹幕
  | 'danmaku_sweeper'    // 删5条弹幕
  | 'danmaku_cleaner'    // 删3条攻击性弹幕

export interface Achievement {
  id: AchievementId;
  title: string;
  desc: string;
  icon: string;
  /** 隐藏成就（不解锁时显示???） */
  hidden?: boolean;
}

export const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  first_blood:         { id: 'first_blood',      title: '初次直播',     desc: '完成第一次表演',                         icon: '🎬' },
  first_laugh:         { id: 'first_laugh',      title: '绷不住了',     desc: '第一次拿到 5 分以上',                     icon: '😂' },
  prop_master:         { id: 'prop_master',      title: '物理课代表',   desc: '用过 10 种不同道具',                      icon: '🔬' },
  perfect_10:          { id: 'perfect_10',       title: '笑点狙击手',   desc: '单次表演拿到满分 10 分',                  icon: '🎯' },
  speedrun_god:        { id: 'speedrun_god',     title: '速通玩家',     desc: '3 回合内通关一个关卡',                     icon: '⏱️' },
  no_banana:           { id: 'no_banana',        title: '拒绝滑倒',     desc: '不使用香蕉皮通关任意关卡',                   icon: '🚫🍌' },
  all_explosive:       { id: 'all_explosive',    title: '爆破鬼才',     desc: '一关内只用爆炸类道具通关',                   icon: '💣' },
  chain_3:             { id: 'chain_3',          title: '蝴蝶效应',     desc: '一次表演触发 3 个道具的连锁反应',             icon: '🦋' },
  cliff_hanger:        { id: 'cliff_hanger',     title: '悬崖勒马',     desc: '悬崖场景通关',                           icon: '🏔️' },
  rapids_survivor:     { id: 'rapids_survivor',  title: '激流勇进',     desc: '猛龙过江场景通关',                         icon: '🌊' },
  wind_rider:          { id: 'wind_rider',       title: '乘风破浪',     desc: '暴风场景通关',                           icon: '💨' },
  dark_clear:          { id: 'dark_clear',       title: '暗夜潜行',     desc: '至暗时刻场景通关',                         icon: '🕶️' },
  kentou_million:      { id: 'kentou_million',   title: '肯头大户',     desc: '累计获取 1000 肯头',                      icon: '💰' },
  banana_only:         { id: 'banana_only',      title: '香蕉共和国',   desc: '只用香蕉皮完成一关的所有表演',                 icon: '🍌' },
  npc_solo:            { id: 'npc_solo',         title: '独角戏',       desc: '一回合只放主角没放任何其他道具',               icon: '🎭' },
  big_spender:         { id: 'big_spender',      title: '氪金战士',     desc: '单回合花费 20 头肯以上',                    icon: '💸' },
  collector:           { id: 'collector',        title: '全副武装',     desc: '购买全部商店道具',                         icon: '🛒' },
  danmaku_king:        { id: 'danmaku_king',     title: '弹幕刷屏',     desc: '累计收到 20 条 AI 弹幕',                   icon: '📺' },
  silent_all:          { id: 'silent_all',       title: '沉默是金',     desc: '单次表演拿到 0 分',                      icon: '🤐' },
  triple_0:            { id: 'triple_0',         title: '三连沉默',     desc: '连续 3 回合都拿到 0 分',                   icon: '😶' },
  comeback:            { id: 'comeback',         title: '绝地反击',     desc: '0 分回合后，下一回合拿到 8 分以上',            icon: '🔥' },
  first_danmaku:       { id: 'first_danmaku',    title: '房管上线',     desc: '发送第一条快捷弹幕',                       icon: '⌨️' },
  danmaku_spammer:     { id: 'danmaku_spammer',  title: '弹幕刷子',     desc: '累计发送 10 条快捷弹幕',                    icon: '📣' },
  danmaku_sweeper:     { id: 'danmaku_sweeper',  title: '房管执法',     desc: '累计删除 5 条弹幕',                       icon: '🧹' },
  danmaku_cleaner:     { id: 'danmaku_cleaner',  title: '净化直播间',   desc: '累计删除 3 条攻击性弹幕',                   icon: '🚫' },
};
