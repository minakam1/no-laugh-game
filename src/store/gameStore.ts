// ============================================================
// Zustand GameStore（README 5.3 节 + 第十三章类型）
// ============================================================

import { create } from 'zustand';
import { eventBus } from '@/phaser/bridges/PhaserEventBus';
import { SCENE_CONFIGS } from '@/types';
import type {
  GameState,
  RoundResult,
  RoundRecord,
  SaveData,
  DifficultyConfig,
  ActionType,
  SceneType,
  TutorialStep,
} from '@/types';
import { classifyAction, hasProtagonist } from '@/utils/classifyAction';
import { useAchievementStore } from '@/store/achievementStore';

// 难度配置表（README 5.3 + 4.7 节）
// targetAvgScore: 裁判打分 0-10 的平均线（用于展示参考）
// hardPassThreshold: 困难模式通关所需绷不住值
export const DIFFICULTY_CONFIG: Record<number, DifficultyConfig> = {
  1: { level: 1, name: '快乐小狗', baselineCoefficient: 1.0, targetAvgScore: 5, maxRounds: 10, hardPassThreshold: 40 },
  2: { level: 2, name: '好奇大学生', baselineCoefficient: 1.1, targetAvgScore: 6, maxRounds: 10, hardPassThreshold: 45 },
  3: { level: 3, name: '淡定上班族', baselineCoefficient: 1.3, targetAvgScore: 7, maxRounds: 10, hardPassThreshold: 50 },
  4: { level: 4, name: '文艺鉴赏家', baselineCoefficient: 1.6, targetAvgScore: 7.5, maxRounds: 10, hardPassThreshold: 55 },
  5: { level: 5, name: '冷面裁判官', baselineCoefficient: 2.5, targetAvgScore: 8, maxRounds: 10, hardPassThreshold: 60 },
};

/** 头肯常量 */
export const INITIAL_POINTS = 28;
export const INITIAL_POINTS_ENDLESS = 36;
export const LEVEL_START_POINTS_BONUS = 2;
export const SUPER_CHAT_REWARD = 5;
export const SCORE_TO_POINTS = 1;

// ============ 加分系统常量（类似愤怒的小鸟） ============
/** 普通模式通关基础门槛 */
export const PASS_THRESHOLD = 30;
/** 困难模式衰减惩罚倍率（衰减速度翻倍） */
export const HARD_DECAY_MULTIPLIER = 2.0;
/** 困难模式基础增益倍率（单次得分更低） */
export const HARD_GAIN_MULTIPLIER = 0.7;
/** 困难模式头肯获取倍率（收益减少） */
export const HARD_POINTS_MULTIPLIER = 0.6;
/** 超出门槛每分换肯头的倍率 */
export const BONUS_KENTOU_RATE = 0.35;
/** 困难模式加分倍率 */
export const HARD_BONUS_RATE = 0.5;
/** 轮数奖励：每节省一轮奖励肯头数 */
export const ROUND_BONUS_PER_SAVED = 1;
/** 时间奖励：每秒节省奖励肯头数（3分钟=180秒基准） */
export const TIME_BONUS_PER_SEC = 0.05;
/** 时间基准：3分钟 = 180秒 */
export const TIME_BASELINE_SEC = 180;
/** 通关基础肯头奖励 */
export const CLEAR_BONUS_KENTOU = 2;

/** 根据难度获取当前通关阈值 */
export function getPassThreshold(level: number, difficulty: 'normal' | 'hard'): number {
  if (difficulty === 'hard') {
    return DIFFICULTY_CONFIG[level]?.hardPassThreshold ?? (30 + level * 5);
  }
  return PASS_THRESHOLD;
}

export function calcRoundPointsReward(funnyScore: number, difficulty: 'normal' | 'hard'): number {
  if (funnyScore <= 0) return 0;
  const pointsMultiplier = difficulty === 'hard' ? HARD_POINTS_MULTIPLIER : 1.0;
  return Math.round((Math.round(funnyScore * SCORE_TO_POINTS) + SUPER_CHAT_REWARD) * pointsMultiplier);
}

function getStartingPoints(mode: 'story' | 'endless', level: number): number {
  if (mode === 'endless') return INITIAL_POINTS_ENDLESS;
  return INITIAL_POINTS + (level - 1) * LEVEL_START_POINTS_BONUS;
}

function getSceneSwitchCost(sceneType: SceneType): number {
  return SCENE_CONFIGS.find((scene) => scene.key === sceneType)?.cost ?? 0;
}

const DEFAULT_UNLOCKED_SCENES: SceneType[] = ['normal', 'rapids', 'darkness'];

// ============ 商店道具类型 ============
export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  cost: number;
  effect: string; // 效果描述
  maxOwn: number; // 最大持有数
  sceneUnlock?: SceneType; // 永久解锁场景
}

/** 商店道具定义 */
export const SHOP_ITEMS: Record<string, ShopItem> = {
  mint: {
    id: 'mint',
    name: '冷静薄荷糖',
    emoji: '🧊',
    description: '单回合衰减惩罚减半',
    cost: 15,
    effect: 'decay_halve',
    maxOwn: 3,
  },
  spotlight: {
    id: 'spotlight',
    name: '观众引导灯',
    emoji: '🎯',
    description: '指定一个道具获得+3额外绷不住值',
    cost: 20,
    effect: 'prop_bonus_3',
    maxOwn: 2,
  },
  hourglass: {
    id: 'hourglass',
    name: '延时沙漏',
    emoji: '⏳',
    description: '本关回合上限+2',
    cost: 25,
    effect: 'rounds_plus_2',
    maxOwn: 2,
  },
  smoke: {
    id: 'smoke',
    name: 'AI迷惑烟雾',
    emoji: '🛡️',
    description: '跳过质检员评分，直接获得5分',
    cost: 30,
    effect: 'skip_judge_5',
    maxOwn: 1,
  },
  superBomb: {
    id: 'superBomb',
    name: 'Super Chat轰炸',
    emoji: '💰',
    description: '本轮AI评分+3',
    cost: 40,
    effect: 'score_plus_3',
    maxOwn: 2,
  },
  bribeEnvelope: {
    id: 'bribeEnvelope',
    name: '贿赂专用信封',
    emoji: '💌',
    description: '使用后立即获得18头肯，可在场内购买道具',
    cost: 18,
    effect: 'points_plus_18',
    maxOwn: 10,
  },
  retryToken: {
    id: 'retryToken',
    name: '再来一瓶',
    emoji: '🔄',
    description: '失败后重试本关，保留一半头肯',
    cost: 50,
    effect: 'retry_level',
    maxOwn: 1,
  },
  sceneCliff: {
    id: 'sceneCliff',
    name: '悬崖许可',
    emoji: '🧗',
    description: '永久解锁「悬崖」场景',
    cost: 20,
    effect: 'unlock_scene_cliff',
    maxOwn: 1,
    sceneUnlock: 'cliff',
  },
  sceneWindstorm: {
    id: 'sceneWindstorm',
    name: '暴风许可',
    emoji: '🌪️',
    description: '永久解锁「暴风」场景',
    cost: 30,
    effect: 'unlock_scene_windstorm',
    maxOwn: 1,
    sceneUnlock: 'windstorm',
  },
};

const SAVE_VERSION = 2; // 版本升级：加入签名校验
const SAVE_KEY = 'no-laugh-save';
const DB_NAME = 'NoLaughDB';
const DB_STORE = 'saves';

// 存档签名盐值（仅用于检测篡改，非加密安全用途）
const SAVE_SALT = 'nlg_sig_7742x';

/** 对关键数据字段计算简单校验哈希（防普通玩家篡改） */
function computeChecksum(data: SaveData): string {
  const fields = [
    data.storyProgress.unlockedLevels,
    data.storyProgress.bestScores?.[1] ?? 0,
    data.kentou,
    data.points,
    data.hasBeatenFirstLevel,
    data.tutorialCompleted,
    data.endlessBest.highScore,
    Object.keys(data.inventory ?? {}).join(','),
    Object.values(data.inventory ?? {}).join(','),
    SAVE_SALT,
  ];
  const raw = fields.join('|');
  // djb2 哈希
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

/** 校验存档完整性，返回有效数据或 null */
function verifySaveIntegrity(data: SaveData): SaveData | null {
  if (data.version !== SAVE_VERSION) return null;
  // 兼容旧存档（无签名）
  if (!data.signature) return data;
  const expected = computeChecksum(data);
  if (expected !== data.signature) {
    console.warn('[安全] 存档签名校验失败，数据可能已被篡改');
    return null;
  }
  return data;
}

function createInitialGameData() {
  return {
    meter: { value: 0, rounds: [], decayMap: {} },
    currentLevel: 1,
    currentRound: 1,
    maxRounds: 10,
    mode: 'story' as const,
    phase: 'editing' as const,
    unlockedLevels: 1,
    bestScores: {},
    endlessHighScore: 0,
    endlessBestLevel: 1,
    judgeDismissedRound: 0,
    points: INITIAL_POINTS,
    kentou: 0,
    hasBeatenFirstLevel: false,
    gameStartTime: 0,
    inventory: {},
    unlockedScenes: [...DEFAULT_UNLOCKED_SCENES],
    activeShopEffects: [],
    difficulty: 'normal' as const,
    sceneType: 'normal' as const,
    tutorialStep: null,
    tutorialCompleted: false,
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  ...createInitialGameData(),

  markGameStart: () => {
    set({ gameStartTime: Date.now() });
  },

  startRound: () => {
    set({ phase: 'editing' });
  },

  submitResult: (result: RoundResult) => {
    const state = get();
    const { meter, mode, currentLevel, currentRound, maxRounds, activeShopEffects, difficulty } = state;
    const actionType: ActionType = classifyAction(result.props, result.chains);
    const useCount = meter.decayMap[actionType] || 0;
    // 主角特殊规则：使用主角不算重复，不受衰减惩罚
    const usingProtagonist = hasProtagonist(result.props);
    // 困难模式衰减更快
    const decayRate = difficulty === 'hard' ? 0.35 * HARD_DECAY_MULTIPLIER : 0.35;
    let decayFactor = usingProtagonist ? 1.0 : Math.max(0.2, 1 - useCount * decayRate);
    
    // 商店道具：冷静薄荷糖 - 衰减减半
    if (activeShopEffects.includes('decay_halve')) {
      decayFactor = usingProtagonist ? 1.0 : Math.max(0.2, 1 - useCount * decayRate * 0.5);
    }
    
    // 商店道具：AI迷惑烟雾 - 跳过裁判，直接给5分
    let funnyScore = result.funnyScore;
    if (activeShopEffects.includes('skip_judge_5')) {
      funnyScore = Math.max(funnyScore, 5);
    }
    
    // 商店道具：Super Chat轰炸 - AI评分+3
    if (activeShopEffects.includes('score_plus_3')) {
      funnyScore = Math.min(10, funnyScore + 3);
    }
    
    // 困难模式：基础增益降低
    const gainMultiplier = difficulty === 'hard' ? HARD_GAIN_MULTIPLIER : 1.0;
    const baseGain = (funnyScore / 10) * 15 * gainMultiplier;
    // 主角基础加分：每次使用主角额外 +2 点绷不住值（困难模式减半）
    const protagonistBonus = usingProtagonist ? (difficulty === 'hard' ? 1 : 2) : 0;
    // 商店道具：观众引导灯 - 道具额外+3（困难模式减为+1.5）
    const spotlightBonus = activeShopEffects.includes('prop_bonus_3') ? (difficulty === 'hard' ? 1.5 : 3) : 0;
    const actualGain = baseGain * decayFactor + protagonistBonus + spotlightBonus;
    const newValue = Math.min(100, meter.value + actualGain);

    const roundRecord: RoundRecord = {
      funnyScore,
      actualGain: Math.round(actualGain * 10) / 10,
      actionType,
      decayFactor,
      reaction: result.reaction,
      reason: result.reason,
      motionSummary: result.motionSummary,
    };

    const newRounds = [...meter.rounds, roundRecord];
    const newRound = currentRound + 1;
    const isLevelComplete = mode === 'story' && newRound > maxRounds;

    // 每次表演获得头肯（困难模式收益减少）
    const earnedPoints = calcRoundPointsReward(funnyScore, difficulty);
    
    // 消耗一次性商店道具效果，仅保留整关持续效果
    const persistentEffects = activeShopEffects.filter((e) => e === 'rounds_plus_2');

    const threshold = getPassThreshold(currentLevel, difficulty);
    const updates: Partial<GameState> = {
      meter: {
        value: newValue,
        rounds: newRounds,
        // 主角特殊规则：使用主角不增加衰减计数
        decayMap: usingProtagonist
          ? meter.decayMap
          : { ...meter.decayMap, [actionType]: useCount + 1 },
      },
      currentRound: newRound,
      points: state.points + earnedPoints,
      activeShopEffects: persistentEffects,
      phase: isLevelComplete ? 'result' : (funnyScore > 0 ? 'editing' : 'judging'),
    };

    // 故事/测试模式通关结算
    if (isLevelComplete) {
      const passed = newValue >= threshold;

      updates.unlockedLevels = passed
        ? Math.max(state.unlockedLevels, currentLevel + 1)
        : state.unlockedLevels;

      updates.bestScores = {
        ...state.bestScores,
        [currentLevel]: Math.max(
          state.bestScores[currentLevel] || 0,
          Math.round(newValue),
        ),
      };

      // 通关第一局后解锁商店和难度选择
      if (passed && !state.hasBeatenFirstLevel) {
        updates.hasBeatenFirstLevel = true;
      }

      // 肯头通关奖励由 ResultModal 统一发放，避免满回合结算重复到账。
    }

    // 无尽模式最高分
    if (mode === 'endless') {
      const totalScore = newValue + state.currentRound;
      updates.endlessHighScore = Math.max(state.endlessHighScore, totalScore);
      updates.endlessBestLevel = Math.max(state.endlessBestLevel, currentLevel);
    }

    set(updates);

    // === 成就检测 ===
    const usedProps = result.props.map((p) => p.type);
    const chainsCount = result.chains?.length ?? 0;
    useAchievementStore.getState().checkOnSubmit(roundRecord, usedProps, chainsCount);

    if (isLevelComplete) {
      useAchievementStore.getState().checkOnClear(currentLevel, newRound, state.sceneType, passed, difficulty);
    }
  },

  updateRoundScore: (roundIndex: number, funnyScore: number, reason: string) => {
    const state = get();
    const rounds = [...state.meter.rounds];
    if (roundIndex < 0 || roundIndex >= rounds.length) return;

    const oldRecord = rounds[roundIndex];
    const decayFactor = oldRecord.decayFactor;
    const baseGain = (funnyScore / 10) * 15;
    const actualGain = baseGain * decayFactor;

    // 重新计算 meter.value：减去旧的 actualGain，加上新的
    const newValue = Math.min(100,
      Math.max(0, state.meter.value - oldRecord.actualGain + actualGain)
    );

    rounds[roundIndex] = {
      ...oldRecord,
      funnyScore,
      actualGain: Math.round(actualGain * 10) / 10,
      reason,
    };

    // 判断是否是最后一回合
    const isLastRound = state.mode === 'story' && state.currentRound > state.maxRounds;
    const threshold = getPassThreshold(state.currentLevel, state.difficulty);

    const updates: Partial<GameState> = {
      meter: {
        ...state.meter,
        value: newValue,
        rounds,
      },
      phase: isLastRound ? 'result' : 'editing',
    };

    // 故事/测试模式通关结算
    if (isLastRound) {
      const passed = newValue >= threshold;
      updates.unlockedLevels = passed
        ? Math.max(state.unlockedLevels, state.currentLevel + 1)
        : state.unlockedLevels;
      updates.bestScores = {
        ...state.bestScores,
        [state.currentLevel]: Math.max(
          state.bestScores[state.currentLevel] || 0,
          Math.round(newValue),
        ),
      };

      // 修正分数后如果通关第一局，解锁商店和难度选择
      if (passed && !state.hasBeatenFirstLevel) {
        updates.hasBeatenFirstLevel = true;
      }
    }

    set(updates);
  },

  /** 用户点击"继续"关闭裁判卡片，回到等待表演信号输入状态 */
  dismissJudgeCard: () => {
    const state = get();
    set({ judgeDismissedRound: state.meter.rounds.length });
  },

  /** 分数达标后用户手动点击"立即执行"触发结算 */
  forceSettle: () => {
    const state = get();
    const newValue = state.meter.value;
    const threshold = getPassThreshold(state.currentLevel, state.difficulty);
    const passed = newValue >= threshold;
    const effectiveStartTime = state.gameStartTime > 0 ? state.gameStartTime : Date.now();

    set({
      phase: 'result',
      gameStartTime: effectiveStartTime,
      unlockedLevels: passed
        ? Math.max(state.unlockedLevels, state.currentLevel + 1)
        : state.unlockedLevels,
      bestScores: {
        ...state.bestScores,
        [state.currentLevel]: Math.max(
          state.bestScores[state.currentLevel] || 0,
          Math.round(newValue),
        ),
      },
      hasBeatenFirstLevel: passed ? true : state.hasBeatenFirstLevel,
    });
  },

  nextLevel: () => {
    set((s) => {
      const nextLevel =
        s.mode === 'story'
          ? Math.min(s.currentLevel + 1, s.unlockedLevels)
          : Math.min(s.currentLevel + 1, 99);
      return {
        currentLevel: nextLevel,
        currentRound: 1,
        meter: { value: 0, rounds: [], decayMap: {} },
        phase: 'editing',
        judgeDismissedRound: 0,
        gameStartTime: Date.now(),
        activeShopEffects: [],
        points: getStartingPoints(s.mode, nextLevel),
      };
    });
  },

  reset: () => {
    set((s) => ({
      meter: { value: 0, rounds: [], decayMap: {} },
      currentRound: 1,
      phase: 'editing',
      judgeDismissedRound: 0,
      gameStartTime: Date.now(),
      activeShopEffects: [],
      // 重置头肯到初始值
      points: getStartingPoints(s.mode, s.currentLevel),
    }));
  },

  /** 仅清空画布道具，保留分数和回合状态（编辑阶段"重置舞台"按钮用） */
  clearCanvas: () => {
    eventBus.emit('request-clear-scene');
  },

  setMode: (mode, level, difficulty) => {
    const lvl = Math.min(level ?? get().currentLevel, 5);
    const diff = difficulty ?? get().difficulty;
    const baseRounds = mode === 'endless' ? Infinity : 10;
    const effects = get().activeShopEffects;
    const extraRounds = effects.includes('rounds_plus_2') ? 2 : 0;
    // 首次进入困难模式成就
    if (diff === 'hard' && !useAchievementStore.getState().track.hardModeEntered) {
      useAchievementStore.setState((s) => ({ track: { ...s.track, hardModeEntered: true } }));
      useAchievementStore.getState().unlock('enter_hard');
    }
    set({
      mode,
      currentLevel: lvl,
      currentRound: 1,
      maxRounds: baseRounds === Infinity ? Infinity : baseRounds + extraRounds,
      meter: { value: 0, rounds: [], decayMap: {} },
      phase: 'editing',
      judgeDismissedRound: 0,
      gameStartTime: Date.now(),
      difficulty: diff,
      points: getStartingPoints(mode, lvl),
    });
  },

  setDifficulty: (difficulty) => {
    // 首次进入困难模式成就
    if (difficulty === 'hard' && !useAchievementStore.getState().track.hardModeEntered) {
      useAchievementStore.setState((s) => ({ track: { ...s.track, hardModeEntered: true } }));
      useAchievementStore.getState().unlock('enter_hard');
    }
    set({ difficulty });
  },

  setSceneType: (sceneType: SceneType) => {
    const state = get();
    if (sceneType === state.sceneType) return true;
    if (!state.unlockedScenes.includes(sceneType)) return false;

    const cost = getSceneSwitchCost(sceneType);
    if (state.points < cost) return false;

    set({ sceneType, points: state.points - cost });
    if (cost > 0) {
      useAchievementStore.getState().trackSpend(cost);
    }
    return true;
  },

  loadSave: (data: SaveData) => {
    set({
      unlockedLevels: data.storyProgress.unlockedLevels,
      bestScores: data.storyProgress.bestScores,
      endlessHighScore: data.endlessBest.highScore,
      endlessBestLevel: data.endlessBest.bestLevel,
      points: data.points ?? INITIAL_POINTS,
      kentou: data.kentou ?? 0,
      hasBeatenFirstLevel: data.hasBeatenFirstLevel ?? false,
      inventory: data.inventory ?? {},
      unlockedScenes: data.unlockedScenes ?? [...DEFAULT_UNLOCKED_SCENES],
      tutorialCompleted: data.tutorialCompleted ?? false,
      tutorialStep: (data.tutorialCompleted ?? false) ? null : null,
    });
  },

  spendPoints: (amount: number) => {
    const state = get();
    if (state.points < amount) return false;
    set({ points: state.points - amount });
    useAchievementStore.getState().trackSpend(amount);
    return true;
  },

  addPoints: (amount: number) => {
    set((s) => ({ points: s.points + amount }));
  },

  refundPoints: (amount: number) => {
    set((s) => ({ points: s.points + amount }));
  },

  addKentou: (amount: number) => {
    set((s) => ({ kentou: s.kentou + amount }));
    useAchievementStore.getState().trackKentou(amount);
  },

  spendKentou: (amount: number) => {
    const state = get();
    if (state.kentou < amount) return false;
    set({ kentou: state.kentou - amount });
    return true;
  },

  markFirstLevelBeaten: () => {
    set({ hasBeatenFirstLevel: true });
  },

  /** 计算通关加分奖励 */
  calcBonusPoints: () => {
    const state = get();
    const { meter, currentRound, gameStartTime, mode, currentLevel, difficulty } = state;
    const totalValue = Math.round(meter.value);
    const threshold = getPassThreshold(currentLevel, difficulty);
    const passed = totalValue >= threshold;
    const isStory = mode === 'story';
    const usedRounds = isStory ? Math.min(currentRound - 1, 10) : currentRound - 1;
    const usedSeconds = gameStartTime > 0 
      ? Math.round((Date.now() - gameStartTime) / 1000) 
      : 0;

    const baseScore = totalValue;
    const roundBonus = passed ? Math.max(0, (10 - usedRounds) * ROUND_BONUS_PER_SAVED) : 0;
    const timeBonus = passed ? Math.max(0, Math.round((TIME_BASELINE_SEC - usedSeconds) * TIME_BONUS_PER_SEC)) : 0;
    const clearBonus = passed ? CLEAR_BONUS_KENTOU : 0;
    const totalBonus = baseScore + roundBonus + timeBonus;
    // 困难模式加分倍率提高
    const bonusRate = difficulty === 'hard' ? HARD_BONUS_RATE : BONUS_KENTOU_RATE;
    const overThreshold = Math.max(0, totalBonus - threshold);
    const kentouEarned = Math.round(overThreshold * bonusRate) + clearBonus;

    return {
      baseScore,
      roundBonus,
      timeBonus,
      clearBonus,
      totalBonus,
      kentouEarned,
      usedRounds,
      usedSeconds,
      passed,
    };
  },

  /** 购买商店道具（使用肯头） */
  buyShopItem: (itemId: string) => {
    const state = get();
    const item = SHOP_ITEMS[itemId];
    if (!item) return false;

    if (item.sceneUnlock) {
      if (state.unlockedScenes.includes(item.sceneUnlock)) return false;
      if (state.kentou < item.cost) return false;

      set({
        kentou: state.kentou - item.cost,
        unlockedScenes: [...state.unlockedScenes, item.sceneUnlock],
      });
      return true;
    }
    
    const owned = state.inventory[itemId] || 0;
    if (owned >= item.maxOwn) return false;
    if (state.kentou < item.cost) return false;
    
    set({
      kentou: state.kentou - item.cost,
      inventory: { ...state.inventory, [itemId]: owned + 1 },
    });
    return true;
  },

  /** 使用商店道具（在游戏中使用） */
  useShopItem: (itemId: string) => {
    const state = get();
    const owned = state.inventory[itemId] || 0;
    if (owned <= 0) return false;

    const item = SHOP_ITEMS[itemId];
    if (!item) return false;
    if (item.sceneUnlock) return false;

    const newInventory = { ...state.inventory, [itemId]: owned - 1 };
    if (newInventory[itemId] <= 0) delete newInventory[itemId];

    const newEffects = [...state.activeShopEffects, item.effect];

    // 贿赂信封：立即获得头肯，不加入 activeShopEffects
    if (item.effect === 'points_plus_18') {
      set({
        inventory: newInventory,
        points: state.points + 18,
      });
      return true;
    }

    // 延时沙漏特殊处理：直接修改 maxRounds
    const updates: Partial<GameState> = {
      inventory: newInventory,
      activeShopEffects: newEffects,
    };
    
    if (item.effect === 'rounds_plus_2' && state.maxRounds !== Infinity) {
      updates.maxRounds = state.maxRounds + 2;
    }

    set(updates);
    return true;
  },

  /** 设置当前引导步骤 */
  setTutorialStep: (step: TutorialStep) => {
    set({ tutorialStep: step });
  },

  /** 完成新手引导 */
  completeTutorial: () => {
    // 检测「但是，我拒绝！」成就：引导中未使用香蕉皮
    const track = useAchievementStore.getState().track;
    if (!track.usedPropTypes.has('banana')) {
      useAchievementStore.getState().unlock('no_banana');
    }
    set({ tutorialStep: null, tutorialCompleted: true });
  },

  /** 跳过新手引导 */
  skipTutorial: () => {
    set({ tutorialStep: null, tutorialCompleted: true });
  },

  /** 重新开始新手引导 */
  restartTutorial: () => {
    set({ tutorialStep: 'welcome', tutorialCompleted: false });
  },

  resetGameRecords: () => {
    set(createInitialGameData());
  },
}));

// ============ 存档序列化（README 3.4 节）============

export function serializeSave(): SaveData {
  const state = useGameStore.getState();
  const data: SaveData = {
    version: SAVE_VERSION,
    storyProgress: {
      unlockedLevels: state.unlockedLevels,
      bestScores: state.bestScores,
    },
    endlessBest: {
      highScore: state.endlessHighScore,
      bestLevel: state.endlessBestLevel,
    },
    settings: {
      apiKeyHint: sessionStorage.getItem('apiKey')?.slice(-4) || localStorage.getItem('apiKeyHint') || '',
    },
    points: state.points,
    kentou: state.kentou,
    hasBeatenFirstLevel: state.hasBeatenFirstLevel,
    inventory: state.inventory,
    unlockedScenes: state.unlockedScenes,
    tutorialCompleted: state.tutorialCompleted,
    savedAt: Date.now(),
  };
  // 计算防篡改签名
  data.signature = computeChecksum(data);
  return data;
}

// IndexedDB Promise 包装
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) {
        req.result.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function writeIndexedDB(data: SaveData): Promise<void> {
  return openDB().then((db) => {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(data, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

function readIndexedDB(): Promise<SaveData | null> {
  return openDB().then((db) => {
    return new Promise<SaveData | null>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get('current');
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  });
}

function clearIndexedDBSave(): Promise<void> {
  return openDB().then((db) => {
    return new Promise<void>((resolve) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete('current');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  });
}

export async function saveToStorage(): Promise<boolean> {
  const data = serializeSave();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    console.warn('localStorage full, falling back to IndexedDB');
    try {
      await writeIndexedDB(data);
      return true;
    } catch {
      return false;
    }
  }
}

export async function clearStoredSave(): Promise<void> {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }

  try {
    await clearIndexedDBSave();
  } catch {
    // ignore
  }
}

export function loadFromStorage(): SaveData | null {
  // 优先 localStorage
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as SaveData;
      return verifySaveIntegrity(data);
    }
  } catch {
    // ignore
  }

  // 降级 IndexedDB（同步返回 null，异步可读）
  return null;
}

// 异步加载（支持 IndexedDB 回退）
export function loadFromStorageAsync(): Promise<SaveData | null> {
  // 先尝试 localStorage
  const local = loadFromStorage();
  if (local) return Promise.resolve(local);

  // 再尝试 IndexedDB
  return readIndexedDB()
    .then((data) => {
      if (data) return verifySaveIntegrity(data);
      return null;
    })
    .catch(() => null);
}
