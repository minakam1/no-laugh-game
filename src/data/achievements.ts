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
  // === BOSS挑战 ===
  | 'boss1_clear'        // LV1快乐小狗通关（普通）
  | 'boss1_fail'         // LV1快乐小狗失败（普通）
  | 'boss2_clear'        // LV2好奇大学生通关（普通）
  | 'boss2_fail'         // LV2好奇大学生失败（普通）
  | 'boss3_clear'        // LV3淡定上班族通关（普通）
  | 'boss3_fail'         // LV3淡定上班族失败（普通）
  | 'boss4_clear'        // LV4文艺鉴赏家通关（普通）
  | 'boss4_fail'         // LV4文艺鉴赏家失败（普通）
  | 'boss5_clear'        // LV5冷面裁判官通关（普通）
  | 'boss5_fail'         // LV5冷面裁判官失败（普通）
  | 'hard_boss1_clear'   // LV1快乐小狗通关（困难）
  | 'hard_boss1_fail'    // LV1快乐小狗失败（困难）
  | 'hard_boss2_clear'   // LV2好奇大学生通关（困难）
  | 'hard_boss2_fail'    // LV2好奇大学生失败（困难）
  | 'hard_boss3_clear'   // LV3淡定上班族通关（困难）
  | 'hard_boss3_fail'    // LV3淡定上班族失败（困难）
  | 'hard_boss4_clear'   // LV4文艺鉴赏家通关（困难）
  | 'hard_boss4_fail'    // LV4文艺鉴赏家失败（困难）
  | 'hard_boss5_clear'   // LV5冷面裁判官通关（困难）
  | 'hard_boss5_fail'    // LV5冷面裁判官失败（困难）
  | 'hard_clear'         // 困难模式首次通关
  | 'hard_fail'          // 困难模式首次失败
  | 'story_all_clear'    // 普通模式全通关
  | 'hard_all_clear'     // 困难模式全通关
  // === 特殊操作 ===
  | 'enter_hard'          // 首次进入困难模式
  | 'props_5plus'         // 首次单回合摆放5个以上道具
  | 'shadow_stream'       // 表演时使用3个以上相同道具

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
  no_banana:           { id: 'no_banana',        title: '但是，我拒绝！', desc: '引导关卡中不用香蕉皮表演',                   icon: '✋' },
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
  // === BOSS 挑战 ===
  boss1_clear:         { id: 'boss1_clear',      title: '撸狗达人',     desc: '普通模式首次逗笑 快乐小狗',                 icon: '🐶' },
  boss1_fail:          { id: 'boss1_fail',       title: '被狗溜了',     desc: '普通模式首次败给 快乐小狗',                 icon: '🦴' },
  boss2_clear:         { id: 'boss2_clear',      title: '满分毕业',     desc: '普通模式首次逗笑 好奇大学生',               icon: '🎓' },
  boss2_fail:          { id: 'boss2_fail',       title: '延毕警告',     desc: '普通模式首次败给 好奇大学生',               icon: '📝' },
  boss3_clear:         { id: 'boss3_clear',      title: '甲方通过了',   desc: '普通模式首次逗笑 淡定上班族',               icon: '💼' },
  boss3_fail:          { id: 'boss3_fail',       title: '改了又改',     desc: '普通模式首次败给 淡定上班族',               icon: '📋' },
  boss4_clear:         { id: 'boss4_clear',      title: '高山流水',     desc: '普通模式首次逗笑 文艺鉴赏家',               icon: '🎨' },
  boss4_fail:          { id: 'boss4_fail',       title: '对牛弹琴',     desc: '普通模式首次败给 文艺鉴赏家',               icon: '🖼️' },
  boss5_clear:         { id: 'boss5_clear',      title: '无罪释放',     desc: '普通模式首次逗笑 冷面裁判官',               icon: '⚖️' },
  boss5_fail:          { id: 'boss5_fail',       title: '驳回上诉',     desc: '普通模式首次败给 冷面裁判官',               icon: '🔨' },
  hard_clear:          { id: 'hard_clear',       title: '地狱笑话',     desc: '困难模式首次通关任意关卡',                  icon: '😈' },
  hard_fail:           { id: 'hard_fail',        title: '这不好笑',     desc: '困难模式首次败北',                         icon: '💀' },
  // === 困难模式 BOSS ===
  hard_boss1_clear:    { id: 'hard_boss1_clear', title: '地狱三头犬',   desc: '困难模式首次逗笑 快乐小狗',                 icon: '🐕' },
  hard_boss1_fail:     { id: 'hard_boss1_fail',  title: '狗都不玩',     desc: '困难模式首次败给 快乐小狗',                 icon: '🐾' },
  hard_boss2_clear:    { id: 'hard_boss2_clear', title: '诺贝尔提名',   desc: '困难模式首次逗笑 好奇大学生',               icon: '🏆' },
  hard_boss2_fail:     { id: 'hard_boss2_fail',  title: '劝退处理',     desc: '困难模式首次败给 好奇大学生',               icon: '🚫' },
  hard_boss3_clear:    { id: 'hard_boss3_clear', title: '终极甲方',     desc: '困难模式首次逗笑 淡定上班族',               icon: '👔' },
  hard_boss3_fail:     { id: 'hard_boss3_fail',  title: '当场辞职',     desc: '困难模式首次败给 淡定上班族',               icon: '🏃' },
  hard_boss4_clear:    { id: 'hard_boss4_clear', title: '阳春白雪',     desc: '困难模式首次逗笑 文艺鉴赏家',               icon: '🎼' },
  hard_boss4_fail:     { id: 'hard_boss4_fail',  title: '下里巴人',     desc: '困难模式首次败给 文艺鉴赏家',               icon: '🎵' },
  hard_boss5_clear:    { id: 'hard_boss5_clear', title: '刑满释放',     desc: '困难模式首次逗笑 冷面裁判官',               icon: '🔓' },
  hard_boss5_fail:     { id: 'hard_boss5_fail',  title: '死刑立即执行', desc: '困难模式首次败给 冷面裁判官',               icon: '☠️' },
  story_all_clear:     { id: 'story_all_clear',  title: '喜剧之王',     desc: '普通模式通关全部 5 关',                     icon: '👑' },
  hard_all_clear:      { id: 'hard_all_clear',   title: 'AI克星',       desc: '困难模式通关全部 5 关',                     icon: '🔱' },
  // === 特殊操作 ===
  enter_hard:          { id: 'enter_hard',       title: '哟，是质检王来了', desc: '首次进入困难模式',                        icon: '😏' },
  props_5plus:         { id: 'props_5plus',      title: '为什么你这么熟练啊！', desc: '首次单回合摆放 5 个以上道具（含主角）',  icon: '🤌' },
  shadow_stream:       { id: 'shadow_stream',    title: '影流之主',           desc: '一次表演使用 3 个以上相同道具',            icon: '👥' },
};
