// ============================================================
// achievementStore — 成就追踪 + 条件检测
// ============================================================

import { create } from 'zustand';
import { eventBus } from '@/phaser/bridges/PhaserEventBus';
import { ACHIEVEMENTS, type AchievementId } from '@/data/achievements';
import type { RoundRecord, SceneType } from '@/types';
import type { PropKey } from '@/phaser/assets/manifest';

interface AchievementState {
  /** 已解锁成就集合 */
  unlocked: Set<AchievementId>;
  /** 跨回合追踪数据 */
  track: {
    usedPropTypes: Set<PropKey>;
    totalKentouEarned: number;
    totalAiDanmaku: number;
    consecutiveZeros: number;
    prevScore: number;
    roundSpent: number;  // 当前回合花费
    bananaOnlyLevel: boolean;
    explosiveOnlyLevel: boolean;
    levelTotalRounds: number;
    usedScenes: Set<SceneType>;
  };
}

interface AchievementActions {
  unlock: (id: AchievementId) => void;
  /** 回合提交后检测成就 */
  checkOnSubmit: (record: RoundRecord, usedProps: PropKey[], chainsCount: number) => void;
  /** 通关结算时检测成就 */
  checkOnClear: (level: number, totalRounds: number, sceneType: SceneType) => void;
  /** 追踪头肯积累 */
  trackKentou: (amount: number) => void;
  /** 追踪弹幕数 */
  trackDanmaku: () => void;
  /** 追踪单回合花费 */
  trackSpend: (amount: number) => void;
  /** 商店全买 */
  markCollector: () => void;
  /** 加载存档中的成就 */
  loadFromSave: (ids: AchievementId[]) => void;
  /** 导出可存档的成就列表 */
  getSaveData: () => AchievementId[];
  /** 开发者：重置成就与跨回合追踪 */
  resetAchievements: () => void;
}

function createInitialTrack(): AchievementState['track'] {
  return {
    usedPropTypes: new Set(),
    totalKentouEarned: 0,
    totalAiDanmaku: 0,
    consecutiveZeros: 0,
    prevScore: -1,
    roundSpent: 0,
    bananaOnlyLevel: true,
    explosiveOnlyLevel: true,
    levelTotalRounds: 0,
    usedScenes: new Set(),
  };
}

export const useAchievementStore = create<AchievementState & AchievementActions>((set, get) => ({
  unlocked: new Set(),
  track: createInitialTrack(),

  unlock: (id) => {
    const { unlocked } = get();
    if (unlocked.has(id)) return;
    const next = new Set(unlocked);
    next.add(id);
    set({ unlocked: next });
    eventBus.emit('achievement-unlocked', { id });
  },

  checkOnSubmit: (record, usedProps, chainsCount) => {
    const s = get();
    const { unlock, track } = s;

    // 更新追踪
    const newUsed = new Set(track.usedPropTypes);
    usedProps.forEach((p) => newUsed.add(p));
    const hasBanana = usedProps.includes('banana');
    const explosiveTypes: PropKey[] = ['bomb', 'barrel'];
    const isExplosive = usedProps.every((p) => explosiveTypes.includes(p));
    const newDanmaku = track.totalAiDanmaku + 1;
    const newConsecutiveZeros = record.actualGain <= 0 ? track.consecutiveZeros + 1 : 0;

    set({
      track: {
        ...track,
        usedPropTypes: newUsed,
        totalAiDanmaku: newDanmaku,
        consecutiveZeros: newConsecutiveZeros,
        prevScore: record.funnyScore,
        roundSpent: 0,
        bananaOnlyLevel: track.bananaOnlyLevel && (usedProps.length > 0 && usedProps.every((p) => p === 'banana')),
        explosiveOnlyLevel: track.explosiveOnlyLevel && (usedProps.length > 0 && isExplosive),
        levelTotalRounds: track.levelTotalRounds + 1,
      },
    });

    // --- 条件检测 ---
    unlock('first_blood');
    if (record.funnyScore >= 5) unlock('first_laugh');
    if (record.funnyScore === 10) unlock('perfect_10');
    if (newUsed.size >= 10) unlock('prop_master');
    if (chainsCount >= 3) unlock('chain_3');
    if (usedProps.length === 1 && usedProps[0] === 'clumsyNpc') unlock('npc_solo');
    if (track.roundSpent >= 20) unlock('big_spender');
    if (newDanmaku >= 20) unlock('danmaku_king');
    if (record.actualGain <= 0) unlock('silent_all');
    if (newConsecutiveZeros >= 3) unlock('triple_0');
    if (track.prevScore === 0 && record.funnyScore >= 8) unlock('comeback');
  },

  checkOnClear: (level, totalRounds, sceneType) => {
    const s = get();
    const { unlock, track } = s;

    unlock('first_laugh');

    if (totalRounds <= 3) unlock('speedrun_god');
    if (track.bananaOnlyLevel) unlock('banana_only');
    if (track.explosiveOnlyLevel) unlock('all_explosive');
    if (!track.usedPropTypes.has('banana')) unlock('no_banana');

    const newScenes = new Set(track.usedScenes);
    newScenes.add(sceneType);
    set({ track: { ...track, usedScenes: newScenes } });

    if (sceneType === 'cliff') unlock('cliff_hanger');
    if (sceneType === 'rapids') unlock('rapids_survivor');
    if (sceneType === 'windstorm') unlock('wind_rider');
    if (sceneType === 'darkness') unlock('dark_clear');
  },

  trackKentou: (amount) => {
    const t = get().track;
    const total = t.totalKentouEarned + amount;
    set({ track: { ...t, totalKentouEarned: total } });
    if (total >= 1000) get().unlock('kentou_million');
  },

  trackDanmaku: () => {
    const t = get().track;
    const count = t.totalAiDanmaku + 1;
    set({ track: { ...t, totalAiDanmaku: count } });
    if (count >= 20) get().unlock('danmaku_king');
  },

  trackSpend: (amount) => {
    const t = get().track;
    set({ track: { ...t, roundSpent: t.roundSpent + amount } });
  },

  markCollector: () => get().unlock('collector'),

  loadFromSave: (ids) => set({ unlocked: new Set(ids) }),

  getSaveData: () => Array.from(get().unlocked),

  resetAchievements: () => set({ unlocked: new Set(), track: createInitialTrack() }),
}));
