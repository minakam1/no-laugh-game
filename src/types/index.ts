// ============================================================
// 《不许笑》 - TypeScript 类型体系（README 第十三章）
// ============================================================

import type { PropKey } from '@/phaser/assets/manifest';

// ============ 道具 & 场景 ============

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
}

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
  setMode: (mode: 'story' | 'endless', level?: number) => void;
  loadSave: (data: SaveData) => void;
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
}
