// ============================================================
// Motion Relation Graph — 动画事实记录，不预写叙事
// ============================================================

import { PROP_MANIFEST, type PropKey } from '@/phaser/assets/manifest';
import type {
  EventChain,
  MotionObject,
  MotionObjectState,
  MotionRelation,
  MotionRelationGraph,
  MotionRelationType,
  ObservationPacket,
  PlacedProp,
} from '@/types';

const AFFORDANCES: Record<PropKey, string[]> = {
  banana: ['slip', 'wobble', 'physical_accident'],
  portal: ['teleport', 'spatial_mismatch', 'appear_disappear'],
  trampoline: ['compress', 'rebound', 'launch'],
  bomb: ['shake', 'countdown', 'threat'],
  barrel: ['expand', 'explode', 'chain_trigger'],
  clumsyNpc: ['stumble', 'react', 'human_target'],
  coffeeCup: ['shake', 'spill', 'small_mess'],
  springGlove: ['extend', 'punch', 'impact'],
  jetpack: ['lift', 'fire', 'vertical_motion'],
  magnet: ['attract', 'pull', 'field'],
  smokeMachine: ['emit_smoke', 'hide', 'reveal'],
  mirror: ['reflect', 'misdirect', 'duplicate'],
  bicycle: ['roll', 'slide', 'balance_loss'],
  glue: ['stick', 'slow', 'trap'],
  skateboard: ['slide', 'roll', 'loss_of_control'],
  bouncyMushroom: ['bounce', 'rebound', 'soft_launch'],
  hairDryer: ['blow', 'push', 'air_force'],
  reverseGravity: ['invert', 'float', 'gravity_shift'],
  fakeCeiling: ['drop', 'fall', 'overhead_threat'],
  rotatingStage: ['rotate', 'disorient', 'spin'],
};

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function distance(a: MotionObjectState, b: MotionObjectState): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function radius(type: PropKey): number {
  const [w, h] = PROP_MANIFEST[type].size;
  return Math.max(w, h) / 2;
}

function inferMotion(start: MotionObjectState, end: MotionObjectState): string[] {
  const motion = new Set<string>();
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const moved = Math.hypot(dx, dy);
  const angleDelta = Math.abs(end.angle - start.angle);
  const scaleDelta = Math.max(
    Math.abs(end.scaleX - start.scaleX),
    Math.abs(end.scaleY - start.scaleY),
  );
  const alphaDelta = Math.abs(end.alpha - start.alpha);

  if (moved > 8) motion.add('move');
  if (Math.abs(dx) > 8) motion.add(dx > 0 ? 'slide_right' : 'slide_left');
  if (Math.abs(dy) > 8) motion.add(dy > 0 ? 'drop' : 'lift');
  if (angleDelta > 5) motion.add('rotate');
  if (scaleDelta > 0.08) motion.add('scale_pulse');
  if (alphaDelta > 0.12) motion.add('flicker');

  return [...motion];
}

function buildObject(
  prop: PlacedProp,
  before: Record<string, MotionObjectState>,
  after: Record<string, MotionObjectState>,
): MotionObject {
  const start = before[prop.id] ?? {
    x: prop.x,
    y: prop.y,
    angle: prop.rotation,
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
  };
  const end = after[prop.id] ?? start;

  return {
    id: prop.id,
    type: prop.type,
    label: PROP_MANIFEST[prop.type].label,
    start,
    end,
    delta: {
      x: round(end.x - start.x),
      y: round(end.y - start.y),
    },
    motion: inferMotion(start, end),
    affordances: AFFORDANCES[prop.type],
  };
}

function buildPairRelations(objects: MotionObject[]): MotionRelation[] {
  const relations: MotionRelation[] = [];

  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];
      const b = objects[j];
      const startDistance = distance(a.start, b.start);
      const endDistance = distance(a.end, b.end);
      const hitDistance = radius(a.type) + radius(b.type);
      const nearDistance = hitDistance + 120;

      if (startDistance <= hitDistance || endDistance <= hitDistance) {
        relations.push({
          type: 'overlap',
          a: a.id,
          b: b.id,
          distance: round(Math.min(startDistance, endDistance)),
          confidence: 0.9,
        });
      } else if (startDistance <= nearDistance || endDistance <= nearDistance) {
        relations.push({
          type: 'near',
          a: a.id,
          b: b.id,
          distance: round(Math.min(startDistance, endDistance)),
          confidence: 0.7,
        });
      }

      const change = endDistance - startDistance;
      if (Math.abs(change) > 16) {
        relations.push({
          type: change < 0 ? 'moved_toward' : 'moved_away',
          a: a.id,
          b: b.id,
          change: round(change),
          confidence: Math.min(0.95, round(Math.abs(change) / 120)),
        });
      }
    }
  }

  return relations;
}

function buildChainRelations(
  objects: MotionObject[],
  chains: EventChain[],
): MotionRelation[] {
  const objectsByType = new Map<PropKey, MotionObject[]>();
  for (const obj of objects) {
    const bucket = objectsByType.get(obj.type) ?? [];
    bucket.push(obj);
    objectsByType.set(obj.type, bucket);
  }

  const relations: MotionRelation[] = [];

  for (const chain of chains) {
    const sequence = chain.steps.flatMap((step) => [step.subject, step.target]);
    const ids = sequence
      .map((type) => objectsByType.get(type as PropKey)?.[0]?.id)
      .filter((id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index);

    if (ids.length < 2) continue;

    relations.push({
      type: 'possible_chain',
      sequence: ids,
      confidence: Math.min(0.95, 0.55 + ids.length * 0.12),
    });
  }

  return relations;
}

function summarize(objects: MotionObject[], relations: MotionRelation[], effectCount: number) {
  const moved = objects.filter((obj) => obj.motion.length > 0);
  const strongestChain = relations.find((relation) => relation.type === 'possible_chain');
  const chainLabels = strongestChain?.sequence
    ?.map((id) => objects.find((obj) => obj.id === id)?.label)
    .filter((label): label is string => Boolean(label))
    ?? moved.slice(0, 4).map((obj) => obj.label);

  const relationTypes = [...new Set(relations.map((relation) => relation.type))];
  const movingText = moved.length
    ? moved.slice(0, 3).map((obj) => `${obj.label}:${obj.motion.join('/')}`).join(' | ')
    : '没有明显位移，仅有静态关系';

  return {
    text: `运动对象 ${moved.length}/${objects.length}，关系 ${relations.length}，效果 ${effectCount}；${movingText}`,
    chainLabels,
    relationTypes: relationTypes as MotionRelationType[],
    movedCount: moved.length,
    effectCount,
  };
}

export function buildMotionRelationGraph(params: {
  props: PlacedProp[];
  chains: EventChain[];
  before: Record<string, MotionObjectState>;
  after: Record<string, MotionObjectState>;
  effects: string[];
}): MotionRelationGraph {
  const objects = params.props.map((prop) => buildObject(prop, params.before, params.after));
  const relations = [
    ...buildPairRelations(objects),
    ...buildChainRelations(objects, params.chains),
  ];

  return {
    objects,
    relations,
    summary: summarize(objects, relations, params.effects.length),
  };
}

export function buildObservationPacket(params: {
  props: PlacedProp[];
  chains: EventChain[];
  before: Record<string, MotionObjectState>;
  after: Record<string, MotionObjectState>;
  effects: string[];
  durationMs: number;
}): ObservationPacket {
  return {
    version: 1,
    durationMs: params.durationMs,
    graph: buildMotionRelationGraph(params),
    effects: params.effects,
    capturedAt: Date.now(),
  };
}
