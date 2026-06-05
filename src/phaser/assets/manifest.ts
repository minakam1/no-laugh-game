// ============================================================
// Asset Manifest - 20 件道具纹理定义（README 12.2 节）
// 纹理通过 BootScene.generateTexture 动态生成，path 仅作外部 PNG fallback 参考
// ============================================================

export const PROP_MANIFEST = {
  banana: { key: 'prop-banana', label: '香蕉皮', size: [32, 32] as const },
  portal: { key: 'prop-portal', label: '传送门', size: [64, 64] as const },
  trampoline: { key: 'prop-trampoline', label: '弹射板', size: [48, 32] as const },
  bomb: { key: 'prop-bomb', label: '定时炸弹', size: [32, 32] as const },
  barrel: { key: 'prop-barrel', label: '爆炸桶', size: [40, 48] as const },
  clumsyNpc: { key: 'prop-npc', label: '呆萌NPC', size: [32, 48] as const },
  coffeeCup: { key: 'prop-coffee', label: '咖啡杯', size: [16, 20] as const },
  springGlove: { key: 'prop-spring', label: '弹簧拳套', size: [32, 32] as const },
  jetpack: { key: 'prop-jetpack', label: '喷气背包', size: [32, 40] as const },
  magnet: { key: 'prop-magnet', label: '磁铁地板', size: [48, 16] as const },
  smokeMachine: { key: 'prop-smoke', label: '烟雾机', size: [32, 32] as const },
  mirror: { key: 'prop-mirror', label: '镜子', size: [24, 40] as const },
  bicycle: { key: 'prop-bicycle', label: '自行车', size: [48, 32] as const },
  glue: { key: 'prop-glue', label: '胶水地毯', size: [40, 16] as const },
  skateboard: { key: 'prop-skateboard', label: '滑板', size: [40, 16] as const },
  bouncyMushroom: { key: 'prop-mushroom', label: '弹跳蘑菇', size: [24, 32] as const },
  hairDryer: { key: 'prop-dryer', label: '吹风机', size: [24, 32] as const },
  reverseGravity: { key: 'prop-gravity', label: '反向重力区', size: [48, 48] as const },
  fakeCeiling: { key: 'prop-ceiling', label: '假天花板', size: [64, 16] as const },
  rotatingStage: { key: 'prop-stage', label: '旋转舞台', size: [64, 32] as const },
} as const;

export type PropKey = keyof typeof PROP_MANIFEST;

export const PROP_LIST: PropKey[] = Object.keys(PROP_MANIFEST) as PropKey[];

// 道具分类标签类型
export type PropTag = 'physical' | 'explosive' | 'transport' | 'npc' | 'environment' | 'gadget';

// 道具分类标签（README 5.1 节，用于笑点衰减系统）
export const PROP_TAGS: Record<PropTag, PropKey[]> = {
  physical: ['banana', 'springGlove', 'coffeeCup', 'trampoline'],
  explosive: ['bomb', 'barrel'],
  transport: ['portal', 'trampoline', 'jetpack'],
  npc: ['clumsyNpc', 'coffeeCup'],
  environment: ['banana', 'springGlove', 'bomb'],
  gadget: ['smokeMachine', 'mirror', 'springGlove'],
};
