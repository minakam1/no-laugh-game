// ============================================================
// Asset Manifest - 20 件道具纹理定义（README 12.2 节）
// 纹理通过 BootScene.generateTexture 动态生成，path 仅作外部 PNG fallback 参考
// ============================================================

export const PROP_MANIFEST = {
  banana: { key: 'prop-banana', label: '香蕉皮', size: [250, 124] as const, cost: 3 },
  coffeeCup: { key: 'prop-coffee', label: '咖啡杯', size: [32, 40] as const, cost: 3 },
  glue: { key: 'prop-glue', label: '胶水地毯', size: [80, 80] as const, cost: 4 },
  skateboard: { key: 'prop-skateboard', label: '滑板', size: [80, 32] as const, cost: 4 },
  magnet: { key: 'prop-magnet', label: '磁铁地板', size: [300, 300] as const, cost: 5 },
  trampoline: { key: 'prop-trampoline', label: '弹射板', size: [96, 64] as const, cost: 5 },
  bouncyMushroom: { key: 'prop-mushroom', label: '弹跳蘑菇', size: [48, 64] as const, cost: 5 },
  springGlove: { key: 'prop-spring', label: '弹簧拳套', size: [64, 64] as const, cost: 6 },
  smokeMachine: { key: 'prop-smoke', label: '烟雾机', size: [64, 64] as const, cost: 6 },
  mirror: { key: 'prop-mirror', label: '镜子', size: [81, 83] as const, cost: 6 },
  hairDryer: { key: 'prop-dryer', label: '吹风机', size: [48, 64] as const, cost: 6 },
  bomb: { key: 'prop-bomb', label: '定时炸弹', size: [64, 64] as const, cost: 8 },
  barrel: { key: 'prop-barrel', label: '爆炸桶', size: [64, 64] as const, cost: 8 },
  bicycle: { key: 'prop-bicycle', label: '自行车', size: [400, 267] as const, cost: 8 },
  clumsyNpc: { key: 'prop-npc', label: '主角', size: [96, 204] as const, cost: 0 },
  jetpack: { key: 'prop-jetpack', label: '喷气背包', size: [64, 80] as const, cost: 10 },
  portal: { key: 'prop-portal', label: '传送门', size: [64, 64] as const, cost: 10 },
  fakeCeiling: { key: 'prop-ceiling', label: '假天花板', size: [128, 32] as const, cost: 12 },
  reverseGravity: { key: 'prop-gravity', label: '反向重力区', size: [96, 96] as const, cost: 14 },
  rotatingStage: { key: 'prop-stage', label: '旋转舞台', size: [128, 64] as const, cost: 16 },
  wishMachine: { key: 'prop-wish', label: '百变许愿机', size: [40, 40] as const, cost: 12 },
} as const;

export type PropKey = keyof typeof PROP_MANIFEST;

export const PROP_LIST: PropKey[] = Object.keys(PROP_MANIFEST) as PropKey[];

// ============================================================
// 道具质量系统（F=ma：力相同时，质量越大加速度越小）
// ============================================================
export const PROP_MASS: Record<PropKey, number> = {
  banana: 0.3,         // 香蕉皮：极轻，被吹飞/弹飞最远
  coffeeCup: 0.5,      // 咖啡杯：轻
  glue: 1.5,           // 胶水地毯：中（粘在地面上）
  skateboard: 0.8,     // 滑板：轻
  magnet: 4.0,         // 磁铁地板：重
  trampoline: 2.0,     // 弹射板：中
  bouncyMushroom: 1.0, // 弹跳蘑菇：中
  springGlove: 1.5,    // 弹簧拳套：中
  smokeMachine: 2.0,   // 烟雾机：中
  mirror: 1.2,         // 镜子：中偏轻
  hairDryer: 1.0,      // 吹风机：中
  bomb: 2.5,           // 炸弹：中偏重
  barrel: 5.0,         // 爆炸桶：很重
  bicycle: 3.0,        // 自行车：重
  clumsyNpc: 3.5,      // 主角：重
  jetpack: 2.0,        // 喷气背包：中
  portal: Infinity,    // 传送门：固定位置，不可推动
  fakeCeiling: 8.0,    // 假天花板：极重
  reverseGravity: Infinity, // 反重力区：固定位置
  rotatingStage: 6.0,  // 旋转舞台：极重
  wishMachine: 1.5,    // 许愿机：中
};

// 道具分类标签类型
export type PropTag = 'physical' | 'explosive' | 'transport' | 'npc' | 'environment' | 'gadget';

// 道具分类标签（README 5.1 节，用于笑点衰减系统）
export const PROP_TAGS: Record<PropTag, PropKey[]> = {
  physical: ['banana', 'springGlove', 'coffeeCup', 'trampoline'],
  explosive: ['bomb', 'barrel'],
  transport: ['portal', 'trampoline', 'jetpack'],
  npc: ['clumsyNpc', 'coffeeCup'],
  environment: ['banana', 'springGlove', 'bomb'],
  gadget: ['smokeMachine', 'mirror', 'springGlove', 'wishMachine'],
};
