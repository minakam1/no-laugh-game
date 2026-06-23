// ============================================================
// 《不许笑》 - TypeScript 类型体系（README 第十三章）
// ============================================================

import type { PropKey } from '@/phaser/assets/manifest';

// ============ 道具 & 场景 ============

/** 道具物理体：每个道具在表演期间拥有独立的物理状态 */
export interface PhysicsBody {
  /** 道具ID */
  id: string;
  /** 道具类型 */
  type: PropKey;
  /** 质量（影响受力响应：F=ma） */
  mass: number;
  /** 水平速度 (px/frame) */
  vx: number;
  /** 垂直速度 (px/frame) */
  vy: number;
  /** 累积水平力 (px/frame²)，物理积分前清零 */
  fx: number;
  /** 累积垂直力 (px/frame²)，物理积分前清零 */
  fy: number;
  /** 是否在地面上 */
  grounded: boolean;
  /** 被冻住/粘住计时器（>0 时不受力） */
  frozenTimer: number;
  /** 眩晕计时器（>0 时随机偏移） */
  stunTimer: number;
  /** 摩擦系数（1.0=正常，0=无摩擦/滑行，5+=高摩擦/粘滞） */
  friction: number;
}

export interface TriggerConfig {
  type: 'collision' | 'click' | 'timer';
  targetId?: string;
  delay?: number;
  conditions?: string[];
}

export interface PlacedProp {
  id: string;
  type: PropKey;
  x: number;
  y: number;
  rotation: number;
  actor?: string;
  positionDesc?: string;
  triggers: TriggerConfig[];
  wishName?: string; // 许愿机专属：玩家输入的名字（百变后的身份）
}

export interface EventStep {
  type: 'collision' | 'trigger' | 'reaction';
  subject: string;
  target: string;
  result: string;
}

export interface EventChain {
  id: string;
  steps: EventStep[];
}

export interface SceneSnapshot {
  props: PlacedProp[];
  connections: EventChain[];
  timestamp: number;
}

// ============ 运动关系图 ============

export interface MotionPoint {
  x: number;
  y: number;
}

export interface MotionObjectState extends MotionPoint {
  angle: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
}

export interface MotionObject {
  id: string;
  type: PropKey;
  label: string;
  start: MotionObjectState;
  end: MotionObjectState;
  delta: MotionPoint;
  motion: string[];
  affordances: string[];
}

export type MotionRelationType =
  | 'near'
  | 'overlap'
  | 'moved_toward'
  | 'moved_away'
  | 'possible_chain';

export interface MotionRelation {
  type: MotionRelationType;
  a?: string;
  b?: string;
  distance?: number;
  change?: number;
  sequence?: string[];
  confidence?: number;
}

export interface MotionSummary {
  text: string;
  chainLabels: string[];
  relationTypes: MotionRelationType[];
  movedCount: number;
  effectCount: number;
}

export interface MotionRelationGraph {
  objects: MotionObject[];
  relations: MotionRelation[];
  summary: MotionSummary;
}

export interface ObservationPacket {
  version: number;
  durationMs: number;
  graph: MotionRelationGraph;
  effects: string[];
  capturedAt: number;
  sceneType: SceneType;
}

// ============ 场景设定类型 ============

export type SceneType = 'normal' | 'cliff' | 'rapids' | 'darkness' | 'windstorm';

export interface SceneConfig {
  key: SceneType;
  label: string;
  labelCn: string;
  description: string;
  cost: number;
  preview: string;
}

export const SCENE_CONFIGS: readonly SceneConfig[] = [
  { key: 'normal', label: 'NONE', labelCn: '无', description: '默认重力模式', cost: 0, preview: "url('/assets/scenes/scene-bg-normal.png') center / cover no-repeat" },
  { key: 'cliff', label: 'CLIFF', labelCn: '悬崖', description: '舞台右侧有悬崖，掉下去的东西会消失', cost: 8, preview: "url('/assets/scenes/scene-bg-cliff.png') center / cover no-repeat" },
  { key: 'rapids', label: 'RAPID', labelCn: '猛龙过江', description: '底部有快速河流，物品会随河流移动', cost: 6, preview: "url('/assets/scenes/scene-bg-rapids.png') center / cover no-repeat" },
  { key: 'darkness', label: 'DARK', labelCn: '至暗时刻', description: '直到开始表演前舞台都是黑色', cost: 4, preview: "url('/assets/scenes/scene-bg-darkness.png') center / cover no-repeat" },
  { key: 'windstorm', label: 'WIND', labelCn: '暴风', description: '所有物品都会被风吹起来', cost: 10, preview: "url('/assets/scenes/scene-bg-windstorm.png') center / cover no-repeat" },
];

// ============ 引导系统 ============

/** 引导步骤（null = 不在引导中） */
export type TutorialStep =
  | 'welcome'           // 欢迎介绍
  | 'config'            // API配置引导
  | 'menu'              // 模式选择引导
  | 'game_tour'         // 游戏界面导览（4个子区域依次高亮）
  | 'first_round:place' // 首回合：放置道具
  | 'first_round:perform' // 首回合：开始表演
  | 'first_round:watch'   // 首回合：观看AI反应
  | 'result_guide'      // 结算引导
  | null;

// ============ 游戏状态 ============

export type ActionType =
  | 'prop:single'
  | 'prop:combo'
  | 'chain:reaction'
  | 'prop:mixed';

export interface RoundRecord {
  funnyScore: number;
  actualGain: number;
  actionType: ActionType;
  decayFactor: number;
  reaction: string;
  reason: string;
  motionSummary?: MotionSummary;
}

/**
 * 提交给 submitResult 的数据（来自云函数响应 + snapshot 元数据）
 * actualGain 和 decayFactor 由 store 内部计算，传入值被忽略
 */
export interface RoundResult {
  reaction: string;
  funnyScore: number;
  reason: string;
  props: PlacedProp[];
  chains: EventChain[];
  motionSummary?: MotionSummary;
}

export interface BreakdownMeter {
  value: number;
  rounds: RoundRecord[];
  decayMap: Record<string, number>;
}

// 纯数据层：Simulation 状态（不包含 actions）
export interface GameData {
  meter: BreakdownMeter;
  currentLevel: number;
  currentRound: number;
  maxRounds: number;
  mode: 'story' | 'endless';
  phase: 'editing' | 'performing' | 'judging' | 'result';
  unlockedLevels: number;
  bestScores: Record<number, number>;
  endlessHighScore: number;
  endlessBestLevel: number;
  /** 用户已关闭裁判卡片的回合数。>= rounds.length 时 AICommentCard 显示等待状态 */
  judgeDismissedRound: number;
  /** 头肯（局内虚拟货币，每局重置） */
  points: number;
  /** 肯头（局外成长货币，通关第一局后解锁） */
  kentou: number;
  /** 是否已通关第一局（解锁商店和难度选择） */
  hasBeatenFirstLevel: boolean;
  /** 游戏开始时间戳（用于时间奖励计算） */
  gameStartTime: number;
  /** 商店道具持有数 */
  inventory: Record<string, number>;
  /** 已解锁的场景设定 */
  unlockedScenes: SceneType[];
  /** 本关已激活的商店道具效果 */
  activeShopEffects: string[];
  /** 难度：'normal' | 'hard'，默认 normal */
  difficulty: 'normal' | 'hard';
  /** 当前场景设定 */
  sceneType: SceneType;
  /** 当前引导步骤（null = 不在引导中） */
  tutorialStep: TutorialStep;
  /** 是否已完成新手引导 */
  tutorialCompleted: boolean;
}

// Zustand Store 类型 = 纯数据 + actions
export interface GameState extends GameData {
  startRound: () => void;
  submitResult: (result: RoundResult) => void;
  /** 弹幕已显示后，异步更新该回合的裁判评分 */
  updateRoundScore: (roundIndex: number, funnyScore: number, reason: string) => void;
  /** 用户点击"继续"后关闭裁判卡片，回到等待表演信号输入状态 */
  dismissJudgeCard: () => void;
  /** 分数达标后手动触发结算 */
  forceSettle: () => void;
  nextLevel: () => void;
  reset: () => void;
  /** 仅清空画布道具，保留分数和回合状态 */
  clearCanvas: () => void;
  setMode: (mode: 'story' | 'endless', level?: number, difficulty?: 'normal' | 'hard') => void;
  setDifficulty: (difficulty: 'normal' | 'hard') => void;
  setSceneType: (sceneType: SceneType) => boolean;
  loadSave: (data: SaveData) => void;
  /** 花费头肯，返回是否成功 */
  spendPoints: (amount: number) => boolean;
  /** 增加头肯 */
  addPoints: (amount: number) => void;
  /** 退还头肯（撤销道具时） */
  refundPoints: (amount: number) => void;
  /** 增加肯头（局外货币） */
  addKentou: (amount: number) => void;
  /** 花费肯头 */
  spendKentou: (amount: number) => boolean;
  /** 标记已通关第一局 */
  markFirstLevelBeaten: () => void;
  /** 购买商店道具 */
  buyShopItem: (itemId: string) => boolean;
  /** 使用商店道具 */
  useShopItem: (itemId: string) => boolean;
  /** 计算加分奖励（通关后调用） */
  calcBonusPoints: () => BonusResult;
  /** 记录游戏开始时间 */
  markGameStart: () => void;
  /** 设置当前引导步骤 */
  setTutorialStep: (step: TutorialStep) => void;
  /** 完成新手引导 */
  completeTutorial: () => void;
  /** 跳过新手引导 */
  skipTutorial: () => void;
  /** 重新开始新手引导 */
  restartTutorial: () => void;
  /** 开发者：清空游戏记录并恢复初始状态 */
  resetGameRecords: () => void;
}

/** 加分结算结果 */
export interface BonusResult {
  baseScore: number;
  roundBonus: number;
  timeBonus: number;
  clearBonus: number;
  totalBonus: number;
  kentouEarned: number;
  usedRounds: number;
  usedSeconds: number;
  passed: boolean;
}

// ============ 存档 ============

export interface SaveData {
  version: number;
  storyProgress: {
    unlockedLevels: number;
    bestScores: Record<number, number>;
  };
  endlessBest: {
    highScore: number;
    bestLevel: number;
  };
  settings: {
    apiKeyHint: string;
  };
  /** 头肯（局内虚拟货币） */
  points: number;
  /** 肯头（局外成长货币） */
  kentou: number;
  /** 是否已通关第一局 */
  hasBeatenFirstLevel: boolean;
  /** 商店道具库存 */
  inventory: Record<string, number>;
  /** 已解锁的场景设定 */
  unlockedScenes?: SceneType[];
  /** 是否已完成新手引导 */
  tutorialCompleted: boolean;
  /** 已解锁成就 ID 列表 */
  achievements: string[];
  /** 存档签名（防篡改校验） */
  signature?: string;
  savedAt: number;
}

// ============ API 通讯 ============

export interface PerformRequest {
  observation: ObservationPacket;
  level: number;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  supportsImages?: boolean;
  beforeScreenshot?: string;
  afterScreenshot?: string;
}

export interface PerformResponse {
  reaction: string;
  funnyScore: number;
  reason: string;
  isSilence?: boolean;
}

// ============ 难度配置 ============

export interface DifficultyConfig {
  level: number;
  name: string;
  baselineCoefficient: number;
  targetAvgScore: number;
  maxRounds: number;
  /** 困难模式通关所需绷不住值（普通模式仍为30） */
  hardPassThreshold: number;
}
