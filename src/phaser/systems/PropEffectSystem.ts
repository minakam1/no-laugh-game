// ============================================================
// PropEffectSystem — 21个道具物理交互效果（5秒动画）
// 核心原则：
// 1. 所有道具效果对所有物体起作用（不只对主角）
// 2. 力通过质量反比计算加速度（F=ma）
// 3. 两阶段tick：道具效果施力 → 统一物理积分
// ============================================================

import Phaser from 'phaser';
import type { PlacedProp, PhysicsBody } from '@/types';
import { PROP_MANIFEST } from '../assets/manifest';
import type { PropKey } from '../assets/manifest';
import {
  createBody, applyForce, applyImpulse, distBetween,
  integratePhysics, resolveCollisions,
} from './PhysicsEngine';

const DEBUG_PROP_EFFECTS = import.meta.env.DEV;

function debugLog(...args: unknown[]): void {
  if (DEBUG_PROP_EFFECTS) console.log(...args);
}

export interface EffectContext {
  scene: Phaser.Scene;
  /** 所有已放置道具的 Image 引用 (key: prop.id) */
  imageMap: Map<string, Phaser.GameObjects.Image>;
  /** 道具 id → 道具类型 映射 */
  propTypeMap: Map<string, PropKey>;
  /** 画布底部Y坐标 */
  canvasBottom: number;
  /** 画布左边界 */
  canvasLeft: number;
  /** 画布右边界 */
  canvasRight: number;
  /** 每帧所有道具tick执行完毕后的回调（用于悬崖掉落等场景效果强制覆盖） */
  onPostTick?: () => void;
  /** 悬崖模式：平台地面Y坐标（物理引擎以此为地面，道具不可穿过） */
  cliffPlatformY?: number;
}

interface EffectResult {
  description: string;
  tick: (elapsed: number) => void;
  cleanup: () => void;
}

/** 道具间交互共享状态 — 包含物理体映射 */
interface SharedState {
  /** 所有道具的物理体 (propId → PhysicsBody) */
  physicsBodies: Map<string, PhysicsBody>;
  /** 全局粒子池 */
  allParticles: Phaser.GameObjects.GameObject[];
}

type PropEffectFn = (prop: PlacedProp, ctx: EffectContext, shared: SharedState) => EffectResult | null;

type ExplosionParticle = Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle;

type HitStar = Phaser.GameObjects.Star & {
  hitAngle: number;
  hitSpeed: number;
};

type HitRing = Phaser.GameObjects.Arc & {
  isRing: true;
  ringExpandSpeed: number;
};

type HitParticle = HitStar | HitRing;

type SparkleParticle = Phaser.GameObjects.Arc & {
  targetX: number;
  targetY: number;
  progress: number;
};

function safeDestroy(object: Phaser.GameObjects.GameObject): void {
  if (object.active) object.destroy();
}

// ============================================================
// 粒子工厂工具函数
// ============================================================
function spawnSplash(
  scene: Phaser.Scene,
  x: number, y: number,
  color: number,
  count: number,
  depth: number = 6,
): Phaser.GameObjects.Rectangle[] {
  const particles: Phaser.GameObjects.Rectangle[] = [];
  for (let i = 0; i < count; i++) {
    const rect = scene.add.rectangle(
      x + (Math.random() - 0.5) * 10,
      y + (Math.random() - 0.5) * 10,
      3 + Math.random() * 6,
      3 + Math.random() * 6,
      color,
      0.7 + Math.random() * 0.3,
    ).setDepth(depth);
    particles.push(rect);
  }
  return particles;
}

/** 获取除了自身以外的所有物理体+图像对 */
function getOtherBodies(
  selfId: string,
  shared: SharedState,
  ctx: EffectContext,
): { body: PhysicsBody; img: Phaser.GameObjects.Image }[] {
  const result: { body: PhysicsBody; img: Phaser.GameObjects.Image }[] = [];
  for (const [id, body] of shared.physicsBodies) {
    if (id === selfId) continue;
    const img = ctx.imageMap.get(id);
    if (img && img.active) result.push({ body, img });
  }
  return result;
}

// ============================================================
// 效果注册表
// ============================================================
const EFFECT_REGISTRY: Partial<Record<PropKey, PropEffectFn>> = {

  // 1. 香蕉皮 — 让经过的物体滑倒（失去摩擦力，急速滑行+翻滚）
  banana: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    const origX = img.x;
    const splashes: Phaser.GameObjects.Rectangle[] = [];
    let lastSplash = 0;
    const SLIP_RADIUS = 150;
    return {
      description: '香蕉皮让所有经过的物体滑倒翻滚！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        // 自身轻微弹跳
        const bounce = Math.abs(Math.sin(t * 5)) * 20;
        img.y = origY - bounce;
        img.angle = Math.sin(t * 6) * 25;
        // 飞溅
        if (elapsed - lastSplash >= 120) {
          lastSplash = elapsed;
          const particles = spawnSplash(ctx.scene, img.x, img.y + 10, 0xffff00, 4);
          splashes.push(...particles);
          shared.allParticles.push(...particles);
        }
        for (const p of splashes) {
          p.y += 2 + Math.random() * 2;
          p.x += (Math.random() - 0.5) * 6;
          p.alpha -= 0.02;
          if (p.alpha <= 0) p.destroy();
        }
        // 让经过的物体滑倒
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const d = distBetween(img.x, img.y, otherImg.x, otherImg.y);
          if (d < SLIP_RADIUS) {
            // 大幅降低摩擦力 → 物体滑行
            body.friction = 0.1;
            // 给一个横向推力让物体滑走
            const pushDir = otherImg.x > img.x ? 1 : -1;
            applyImpulse(body, pushDir * 8, -3);
            // 旋转 = 滑倒翻滚
            otherImg.angle += pushDir * 5;
          }
        }
      },
      cleanup: () => {
        img.y = origY; img.x = origX; img.angle = 0;
        splashes.forEach((p) => p.destroy());
      },
    };
  },

  // 2. 传送门 — 吸入周围物体（轻物快重物慢）
  portal: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const rings: Phaser.GameObjects.Arc[] = [];
    let lastRing = 0;
    return {
      description: '传送门疯狂旋转，紫色漩涡吞噬一切！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.angle += 5;
        img.setScale(1 + Math.sin(t * 3) * 0.4);
        img.alpha = 0.4 + Math.sin(t * 4) * 0.6;
        img.setTint(Phaser.Display.Color.GetColor(150 + Math.floor(Math.sin(t * 5) * 100), 0, 255));
        // 漩涡环
        if (elapsed - lastRing >= 150) {
          lastRing = elapsed;
          const ring = ctx.scene.add.circle(img.x, img.y, 10, 0x9933ff, 0.5).setDepth(4);
          rings.push(ring);
          shared.allParticles.push(ring);
        }
        for (const r of rings) {
          r.setScale(r.scaleX + 0.08);
          r.alpha -= 0.025;
          if (r.alpha <= 0) r.destroy();
        }
        // 吸入所有周围物体（力除以质量 → 轻物吸入快，重物慢）
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const dx = img.x - otherImg.x;
          const dy = img.y - otherImg.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 250) {
            const force = Math.min(8, 300 / dist);
            applyForce(body, (dx / dist) * force, (dy / dist) * force);
            otherImg.angle += force * 0.5;
            // 靠近时缩小效果
            if (dist < 80) {
              otherImg.setScale(Math.max(0.2, otherImg.scaleX - 0.003));
            }
          }
        }
      },
      cleanup: () => {
        img.angle = 0; img.setScale(1); img.alpha = 1; img.clearTint();
        rings.forEach((r) => r.destroy());
      },
    };
  },

  // 3. 弹射板 — 弹飞落在上面的物体（重物弹得低）
  trampoline: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    const DETECT_RANGE_X = 250;
    const DETECT_RANGE_Y = 200;
    const bouncedSet = new Set<string>();
    return {
      description: '弹射板超级弹跳，所有物体被弹向天际！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        // 弹射板自身弹跳变形
        const bounce = Math.abs(Math.sin(t * 6)) * 20;
        img.y = origY - bounce;
        img.scaleY = 1 + bounce * 0.04;
        img.scaleX = 1 - bounce * 0.03;

        // 弹飞所有在上面的物体
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const dx = otherImg.x - img.x;
          const dy = otherImg.y - img.y;
          if (Math.abs(dx) < DETECT_RANGE_X && Math.abs(dy) < DETECT_RANGE_Y && dy < 80) {
            if (!bouncedSet.has(body.id)) {
              bouncedSet.add(body.id);
              // 弹射力 = 基础力 / 质量 → 重物弹得低
              const bouncePower = 60 / body.mass;
              applyImpulse(body, (Math.random() - 0.5) * 5, -bouncePower);
              // 弹射板压扁
              img.scaleY = 0.25;
              img.scaleX = 2.0;
              // 碰撞物体压扁
              otherImg.setScale(otherImg.scaleX * 1.2, otherImg.scaleY * 0.7);
            }
          }
        }
        // 弹射板恢复
        img.scaleY += (1 - img.scaleY) * 0.15;
        img.scaleX += (1 - img.scaleX) * 0.15;
      },
      cleanup: () => {
        img.y = origY; img.scaleY = 1; img.scaleX = 1;
      },
    };
  },

  // 4. 定时炸弹 — 抖动 + 爆炸冲击波推飞所有物体
  bomb: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origX = img.x;
    const origY = img.y;
    let lastFlash = 0;
    let flashOn = false;
    let exploded = false;
    const explosionRings: ExplosionParticle[] = [];
    const BLAST_RADIUS = 250;
    const BLAST_FORCE = 40;
    return {
      description: '炸弹疯狂抖动，爆炸冲击波掀飞一切！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        const intensity = 1 + t * 2;
        img.x = origX + (Math.random() - 0.5) * 8 * intensity;
        img.y = origY + (Math.random() - 0.5) * 8 * intensity;
        const flashInterval = Math.max(30, 120 - t * 30);
        if (elapsed - lastFlash >= flashInterval) {
          lastFlash = elapsed;
          flashOn = !flashOn;
        }
        if (flashOn) {
          img.setTint(0xff0000);
          img.setScale(1 + Math.random() * 0.2);
        } else {
          img.setTint(0xff4444);
          img.setScale(1);
        }
        // 爆炸！
        if (elapsed > 2600 && !exploded) {
          exploded = true;
          img.setScale(3);
          img.setAlpha(0);
          // 爆炸冲击波环
          for (let i = 0; i < 5; i++) {
            setTimeout(() => {
              const ring = ctx.scene.add.circle(origX, origY, 20 + i * 30, 0xffffff, 0.6 - i * 0.12).setDepth(6);
              explosionRings.push(ring);
              shared.allParticles.push(ring);
            }, i * 60);
          }
          // 爆炸粒子
          for (let i = 0; i < 20; i++) {
            const rect = ctx.scene.add.rectangle(
              origX + (Math.random() - 0.5) * 20,
              origY + (Math.random() - 0.5) * 20,
              6 + Math.random() * 10, 6 + Math.random() * 10,
              Phaser.Display.Color.GetColor(255, Math.floor(100 + Math.random() * 155), 0),
              0.9,
            ).setDepth(7);
            explosionRings.push(rect);
            shared.allParticles.push(rect);
          }
          // 冲击波推飞所有物体（力除以质量 → 轻物飞远，重物微移）
          for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
            const dx = otherImg.x - origX;
            const dy = otherImg.y - origY;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < BLAST_RADIUS) {
              const nx = dx / dist;
              const ny = dy / dist;
              // 力随距离衰减，近处力大远处力小
              const forceFactor = 1 - dist / BLAST_RADIUS;
              const force = BLAST_FORCE * forceFactor;
              applyImpulse(body, nx * force, ny * force - 10 * forceFactor);
              // 爆炸抖动
              body.stunTimer = Math.max(body.stunTimer, 500 * forceFactor);
            }
          }
        }
        // 爆炸粒子扩散
        for (const p of explosionRings) {
          if (p.type === 'Circle') {
            (p as Phaser.GameObjects.Arc).setScale((p as Phaser.GameObjects.Arc).scaleX + 0.1);
            p.alpha -= 0.03;
          } else {
            p.x += (Math.random() - 0.5) * 6;
            p.y += (Math.random() - 0.5) * 6;
            p.alpha -= 0.025;
          }
          if (p.alpha <= 0) p.destroy();
        }
      },
      cleanup: () => {
        img.x = origX; img.y = origY; img.clearTint(); img.setScale(1); img.setAlpha(1);
        explosionRings.forEach(safeDestroy);
      },
    };
  },

  // 5. 爆炸桶 — 膨胀 + 更大爆炸冲击波
  barrel: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origX = img.x;
    const origY = img.y;
    const flames: Phaser.GameObjects.Rectangle[] = [];
    let lastFlame = 0;
    let exploded = false;
    const explosionRings: ExplosionParticle[] = [];
    const BLAST_RADIUS = 320;
    const BLAST_FORCE = 55;
    return {
      description: '爆炸桶急速膨胀，超级爆炸冲击波掀飞全场！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        const s = 1 + Math.abs(Math.sin(t * 3.5)) * 0.4;
        img.setScale(s);
        img.x = origX + (Math.random() - 0.5) * 4;
        img.y = origY + (Math.random() - 0.5) * 4;
        img.setTint(Phaser.Display.Color.GetColor(255, Math.floor(120 - Math.sin(t * 5) * 80), 0));
        // 火焰喷出
        if (elapsed - lastFlame >= 100) {
          lastFlame = elapsed;
          const particles = spawnSplash(ctx.scene, img.x, img.y - 10, 0xff6600, 3);
          flames.push(...particles);
          shared.allParticles.push(...particles);
        }
        for (const p of flames) {
          p.y -= 3 + Math.random() * 2;
          p.x += (Math.random() - 0.5) * 2;
          p.alpha -= 0.03;
          if (p.alpha <= 0) p.destroy();
        }
        // 喷火对附近物体施加小推力
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const d = distBetween(img.x, img.y, otherImg.x, otherImg.y);
          if (d < 120) {
            applyForce(body, (Math.random() - 0.5) * 2, -1.5);
          }
        }
        // 爆炸！
        if (elapsed > 2800 && !exploded) {
          exploded = true;
          img.setScale(3); img.setAlpha(0);
          for (let i = 0; i < 6; i++) {
            const ring = ctx.scene.add.circle(origX, origY, 20 + i * 35, 0xff6600, 0.6 - i * 0.1).setDepth(6);
            explosionRings.push(ring);
            shared.allParticles.push(ring);
          }
          for (let i = 0; i < 25; i++) {
            const rect = ctx.scene.add.rectangle(
              origX + (Math.random() - 0.5) * 30, origY + (Math.random() - 0.5) * 30,
              8 + Math.random() * 12, 8 + Math.random() * 12,
              Phaser.Display.Color.GetColor(255, Math.floor(50 + Math.random() * 200), 0), 0.9,
            ).setDepth(7);
            explosionRings.push(rect);
            shared.allParticles.push(rect);
          }
          // 更大冲击波
          for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
            const dx = otherImg.x - origX;
            const dy = otherImg.y - origY;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < BLAST_RADIUS) {
              const nx = dx / dist;
              const ny = dy / dist;
              const forceFactor = 1 - dist / BLAST_RADIUS;
              const force = BLAST_FORCE * forceFactor;
              applyImpulse(body, nx * force, ny * force - 12 * forceFactor);
              body.stunTimer = Math.max(body.stunTimer, 600 * forceFactor);
            }
          }
        }
        for (const p of explosionRings) {
          if (p.type === 'Circle') {
            (p as Phaser.GameObjects.Arc).setScale((p as Phaser.GameObjects.Arc).scaleX + 0.12);
            p.alpha -= 0.025;
          } else {
            p.x += (Math.random() - 0.5) * 8;
            p.y += (Math.random() - 0.5) * 8;
            p.alpha -= 0.02;
          }
          if (p.alpha <= 0) p.destroy();
        }
      },
      cleanup: () => {
        img.setScale(1); img.x = origX; img.y = origY; img.clearTint(); img.setAlpha(1);
        flames.forEach((p) => p.destroy());
        explosionRings.forEach(safeDestroy);
      },
    };
  },

  // 6. 主角 — 摇晃 + 碰撞推开物体（人体保龄球）
  clumsyNpc: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    const origX = img.x;
    const baseW = img.displayWidth;
    const baseH = img.displayHeight;
    const selfBody = shared.physicsBodies.get(prop.id);
    const greenWaterParticles: Phaser.GameObjects.Rectangle[] = [];
    const hitStars: HitParticle[] = [];
    let lastSpitSpawn = 0;
    let lastHitCheck = 0;
    const hitPropsRedTimers: Map<string, number> = new Map();
    const NPC_SCALE = 3.5;
    let npcHitFlashUntil = 0;
    let npcHitFlashStart = 0;
    let npcHitWhiteFlashStart = 0;
    let npcHitScaleStart = 0;
    let npcHitScaleDuration = 0;
    let npcStunUntil = 0;
    return {
      description: '主角摇摇晃晃，碰撞推飞一切！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        const stunMultiplier = elapsed < npcStunUntil ? 3 : 1;
        img.angle = Math.sin(t * 2 * stunMultiplier) * 10 * stunMultiplier;
        img.y = origY + Math.sin(t * 3 * stunMultiplier) * 4 * stunMultiplier;

        // 碰撞检测：推开所有物体
        if (elapsed - lastHitCheck >= 150 && elapsed < 4500) {
          lastHitCheck = elapsed;
          for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
            const dx = otherImg.x - img.x;
            const dy = otherImg.y - img.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const collisionDist = 120;
            if (dist < collisionDist && dist > 0) {
              const nx = dx / dist;
              const ny = dy / dist;
              // 主角碰撞推力
              const pushForce = 15;
              applyImpulse(body, nx * pushForce, ny * pushForce - 5);
              // 主角自己也受到反作用力（但质量大所以影响小）
              if (selfBody) {
                applyImpulse(selfBody, -nx * pushForce * 0.3, -ny * pushForce * 0.1);
              }
              npcStunUntil = elapsed + 600;
              // 视觉反馈
              otherImg.setTint(0xff4444);
              hitPropsRedTimers.set(body.id, elapsed + 400);
              npcHitFlashStart = elapsed;
              npcHitFlashUntil = elapsed + 500;
              npcHitWhiteFlashStart = elapsed;
              npcHitScaleStart = elapsed;
              npcHitScaleDuration = 350;
              // 相机震动
              ctx.scene.cameras.main.shake(180, 0.008);
              // 星星粒子
              for (let i = 0; i < 8; i++) {
                const angle = Math.random() * Math.PI * 2;
                const star = ctx.scene.add.star(
                  img.x, img.y - 20,
                  4, 3 + Math.random() * 4, 4 + Math.random() * 6,
                  0xff4444, 0.95,
                ).setDepth(7);
                const hitStar = star as HitStar;
                hitStar.hitAngle = angle;
                hitStar.hitSpeed = 3 + Math.random() * 4;
                hitStars.push(hitStar);
                shared.allParticles.push(star);
              }
              // 绿水
              for (let i = 0; i < 10; i++) {
                const rect = ctx.scene.add.rectangle(
                  img.x + (Math.random() - 0.5) * 40,
                  img.y - 10 + (Math.random() - 0.5) * 30,
                  5 + Math.random() * 8, 3 + Math.random() * 6,
                  Phaser.Display.Color.GetColor(
                    Math.floor(20 + Math.random() * 80),
                    Math.floor(180 + Math.random() * 75),
                    Math.floor(40 + Math.random() * 100),
                  ), 0.95,
                ).setDepth(7);
                greenWaterParticles.push(rect);
              }
              break;
            }
          }
        }

        // 受击视觉反馈
        const isWhiteFlash = npcHitWhiteFlashStart > 0 && elapsed < npcHitWhiteFlashStart + 80;
        if (isWhiteFlash) {
          const wfElapsed = elapsed - npcHitWhiteFlashStart;
          const wfIntensity = wfElapsed < 30 ? wfElapsed / 30 : Math.max(0, 1 - (wfElapsed - 30) / 50);
          const gb = Math.floor(255 * (1 - wfIntensity * 0.85));
          img.setTint(Phaser.Display.Color.GetColor(255, gb, gb));
        } else if (npcHitWhiteFlashStart > 0 && elapsed >= npcHitWhiteFlashStart + 80) {
          npcHitWhiteFlashStart = 0;
        }
        if (npcHitFlashUntil > 0 && elapsed < npcHitFlashUntil && !isWhiteFlash) {
          const flashElapsed = elapsed - npcHitFlashStart;
          const flashDuration = npcHitFlashUntil - npcHitFlashStart;
          const progress = Math.max(0, Math.min(1, flashElapsed / flashDuration));
          const eased = 1 - Math.pow(1 - progress, 3);
          img.setTint(Phaser.Display.Color.GetColor(255, Math.floor(eased * 255), Math.floor(eased * 255)));
        } else if (npcHitFlashUntil > 0 && elapsed >= npcHitFlashUntil) {
          img.clearTint();
          npcHitFlashUntil = 0;
        }
        // 尺寸弹跳
        if (npcHitScaleStart > 0 && elapsed < npcHitScaleStart + npcHitScaleDuration) {
          const sProgress = (elapsed - npcHitScaleStart) / npcHitScaleDuration;
          let scaleMod = 1;
          if (sProgress < 0.15) scaleMod = 1 - sProgress / 0.15 * 0.15;
          else if (sProgress < 0.4) scaleMod = 0.85 + (sProgress - 0.15) / 0.25 * 0.25;
          else {
            const p = (sProgress - 0.4) / 0.6;
            const damped = Math.sin(p * Math.PI * 1.5) * Math.exp(-p * 4);
            scaleMod = 1.0 + damped * 0.05;
          }
          img.setDisplaySize(baseW * scaleMod, baseH * scaleMod);
        } else if (npcHitScaleStart > 0 && elapsed >= npcHitScaleStart + npcHitScaleDuration) {
          img.setDisplaySize(baseW, baseH);
          npcHitScaleStart = 0;
        }

        // 碰撞道具变红消退
        for (const [otherId, timer] of hitPropsRedTimers) {
          if (elapsed >= timer) {
            const otherImg = ctx.imageMap.get(otherId);
            if (otherImg) otherImg.clearTint();
            hitPropsRedTimers.delete(otherId);
          }
        }

        // 持续喷绿水
        const hasNearby = Array.from(ctx.imageMap.entries()).some(([id, otherImg]) => {
          if (id === prop.id) return false;
          return distBetween(img.x, img.y, otherImg.x, otherImg.y) < 150;
        });
        if (hasNearby && elapsed - lastSpitSpawn >= 100 && elapsed < 4500) {
          lastSpitSpawn = elapsed;
          for (let i = 0; i < 2; i++) {
            const rect = ctx.scene.add.rectangle(
              img.x + img.displayWidth / 2 + Math.random() * 15,
              img.y - 10 + (Math.random() - 0.5) * 25,
              4 + Math.random() * 6, 3 + Math.random() * 5,
              Phaser.Display.Color.GetColor(30 + Math.floor(Math.random() * 60), 200 + Math.floor(Math.random() * 55), 50 + Math.floor(Math.random() * 80)),
              0.85,
            ).setDepth(6);
            greenWaterParticles.push(rect);
          }
        }

        // 粒子动画
        for (const s of hitStars) {
          if ('isRing' in s) {
            const ring = s;
            ring.setRadius(ring.radius + (ring.ringExpandSpeed || 1.5));
            ring.alpha -= 0.01;
            if (ring.alpha <= 0) ring.destroy();
          } else {
            const star = s;
            star.x += Math.cos(star.hitAngle) * star.hitSpeed;
            star.y += Math.sin(star.hitAngle) * star.hitSpeed;
            star.hitSpeed *= 0.96;
            star.alpha -= 0.022;
            star.angle += 5;
            if (star.alpha <= 0) star.destroy();
          }
        }
        for (const p of greenWaterParticles) {
          p.x += 3 + Math.random() * 2;
          p.y -= 1.5 + Math.random() * 1.5;
          p.alpha -= 0.018;
          p.rotation += 0.12;
          if (p.alpha <= 0) p.destroy();
        }
        for (let i = greenWaterParticles.length - 1; i >= 0; i--) {
          if (greenWaterParticles[i].alpha <= 0) greenWaterParticles.splice(i, 1);
        }
        for (let i = hitStars.length - 1; i >= 0; i--) {
          if (hitStars[i].alpha <= 0) hitStars.splice(i, 1);
        }
      },
      cleanup: () => {
        img.angle = 0; img.y = origY; img.x = origX;
        img.clearTint(); img.setDisplaySize(baseW, baseH);
        greenWaterParticles.forEach((p) => p.destroy());
        hitStars.forEach((s) => { if (s.active) s.destroy(); });
      },
    };
  },

  // 7. 咖啡杯 — 旋转溅射 + 地面湿滑区
  coffeeCup: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origX = img.x;
    const splashes: Phaser.GameObjects.Rectangle[] = [];
    let lastSplash = 0;
    const SLIP_RADIUS = 80;
    return {
      description: '咖啡杯疯狂旋转，滚烫咖啡形成湿滑区域！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.angle += 6;
        img.x = origX + Math.sin(t * 5) * 12;
        if (elapsed - lastSplash >= 120) {
          lastSplash = elapsed;
          const particles = spawnSplash(ctx.scene, img.x, img.y, 0x8B4513, 3);
          splashes.push(...particles);
          shared.allParticles.push(...particles);
        }
        for (const p of splashes) {
          p.y += 1.5;
          p.x += (Math.random() - 0.5) * 3;
          p.alpha -= 0.025;
          if (p.alpha <= 0) p.destroy();
        }
        // 湿滑区域：降低经过物体的摩擦力
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const d = distBetween(img.x, img.y, otherImg.x, otherImg.y);
          if (d < SLIP_RADIUS) {
            body.friction = Math.min(body.friction, 0.2);
            // 轻微减速（咖啡是粘稠液体）
            applyForce(body, (Math.random() - 0.5) * 0.5, 0.3);
          }
        }
      },
      cleanup: () => { img.angle = 0; img.x = origX; splashes.forEach((p) => p.destroy()); },
    };
  },

  // 8. 弹簧拳套 — 伸缩出拳，击飞前方所有物体
  springGlove: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origX = img.x;
    const rings: Phaser.GameObjects.Arc[] = [];
    let lastPunch = 0;
    const PUNCH_RANGE = 180;
    return {
      description: '弹簧拳套猛烈出拳，击飞前方一切！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        const punch = Math.abs(Math.sin(t * 5)) * 0.7;
        img.scaleX = 1 + punch;
        img.x = origX + Math.sin(t * 5) * 20;
        img.setTint(Phaser.Display.Color.GetColor(255, Math.floor(100 - punch * 100), Math.floor(50 - punch * 50)));
        // 出拳冲击波
        if (elapsed - lastPunch >= 160 && punch > 0.3) {
          lastPunch = elapsed;
          const ring = ctx.scene.add.circle(img.x + 35, img.y, 12, 0xff4444, 0.6).setDepth(4);
          rings.push(ring);
          shared.allParticles.push(ring);
          // 击飞前方所有物体（不只主角）
          for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
            const dx = otherImg.x - img.x;
            const dy = otherImg.y - img.y;
            if (Math.abs(dx) < PUNCH_RANGE && Math.abs(dy) < 80 && dx > -20) {
              // 击飞力度受质量影响
              const hitForce = 25;
              applyImpulse(body, hitForce, -10);
              body.stunTimer = Math.max(body.stunTimer, 400);
            }
          }
        }
        for (const r of rings) {
          r.setScale(r.scaleX + 0.1);
          r.alpha -= 0.03;
          if (r.alpha <= 0) r.destroy();
        }
      },
      cleanup: () => { img.scaleX = 1; img.x = origX; img.clearTint(); rings.forEach((r) => r.destroy()); },
    };
  },

  // 9. 喷气背包 — 升空 + 下方火焰推力
  jetpack: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    const origX = img.x;
    const particles: Phaser.GameObjects.Rectangle[] = [];
    let lastFlameSpawn = 0;
    const FLAME_RADIUS = 60;
    return {
      description: '喷气背包点火升空，火焰推走下方一切！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.y = origY - Math.min(t * 40, 80);
        img.x = origX + Math.sin(t * 3) * 20;
        img.angle = Math.sin(t * 6) * 8;
        img.setScale(1 + Math.sin(t * 7) * 0.08);
        if (elapsed - lastFlameSpawn >= 40 && elapsed < 4500) {
          lastFlameSpawn = elapsed;
          for (let i = 0; i < 6; i++) {
            const rect = ctx.scene.add.rectangle(
              img.x + (Math.random() - 0.5) * 20,
              img.y + img.displayHeight / 2 + Math.random() * 20,
              6 + Math.random() * 10,
              10 + Math.random() * 15,
              Phaser.Display.Color.GetColor(255, Math.floor(80 + Math.random() * 175), Math.floor(Math.random() * 60)),
            ).setAlpha(0.9).setDepth(3);
            particles.push(rect);
            shared.allParticles.push(rect);
          }
        }
        for (const p of particles) {
          p.y -= 4 + Math.random() * 2;
          p.x += (Math.random() - 0.5) * 2;
          p.alpha -= 0.022;
          if (p.alpha <= 0) p.destroy();
        }
        for (let i = particles.length - 1; i >= 0; i--) {
          if (particles[i].alpha <= 0) particles.splice(i, 1);
        }
        // 下方火焰区域推走物体
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const dx = otherImg.x - img.x;
          const dy = otherImg.y - img.y;
          // 物体在喷气背包下方
          if (Math.abs(dx) < FLAME_RADIUS && dy > 0 && dy < 150) {
            // 向下推 + 横向抖动
            applyForce(body, (Math.random() - 0.5) * 3, 5);
          }
        }
      },
      cleanup: () => {
        img.y = origY; img.x = origX; img.angle = 0; img.setScale(1);
        particles.forEach((p) => p.destroy());
      },
    };
  },

  // 10. 磁铁地板 — 吸引所有物体（轻物快重物慢）
  magnet: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const sparks: Phaser.GameObjects.Rectangle[] = [];
    let lastSpark = 0;
    const ATTRACT_RADIUS = 300;
    // 金属道具被更强吸引
    const METAL_PROPS = new Set<PropKey>(['bomb', 'barrel', 'bicycle', 'springGlove']);
    return {
      description: '磁铁地板超强吸引一切，轻物飞来重物缓至！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.angle = Math.sin(t * 5) * 10;
        img.setTint(Phaser.Display.Color.GetColor(80, 140, 255));
        // 电火花
        if (elapsed - lastSpark >= 50) {
          lastSpark = elapsed;
          for (const { img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
            const d = distBetween(img.x, img.y, otherImg.x, otherImg.y);
            if (d < ATTRACT_RADIUS) {
              for (let i = 0; i < 2; i++) {
                const spark = ctx.scene.add.rectangle(
                  (img.x + otherImg.x) / 2 + (Math.random() - 0.5) * 30,
                  (img.y + otherImg.y) / 2 + (Math.random() - 0.5) * 30,
                  3, 8 + Math.random() * 6,
                  0x4488ff, 0.85,
                ).setDepth(5);
                sparks.push(spark);
                shared.allParticles.push(spark);
              }
            }
          }
        }
        // 吸引所有物体
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const dx = img.x - otherImg.x;
          const dy = img.y - otherImg.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < ATTRACT_RADIUS) {
            const nx = dx / dist;
            const ny = dy / dist;
            // 金属道具吸引力翻倍
            const isMetal = METAL_PROPS.has(body.type);
            const baseForce = isMetal ? 10 : 4;
            const force = Math.min(baseForce, 200 / dist);
            applyForce(body, nx * force, ny * force);
            otherImg.angle += force * 0.5;
          }
        }
        for (const s of sparks) {
          s.alpha -= 0.05;
          s.y -= 1.5;
          if (s.alpha <= 0) s.destroy();
        }
      },
      cleanup: () => {
        img.angle = 0; img.clearTint();
        sparks.forEach((s) => s.destroy());
      },
    };
  },

  // 11. 烟雾机 — 浓烟减速区域
  smokeMachine: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const particles: Phaser.GameObjects.Arc[] = [];
    let lastSmokeSpawn = 0;
    const SLOW_RADIUS = 100;
    return {
      description: '烟雾机喷出浓烟，区域内一切减速！',
      tick: (elapsed) => {
        if (elapsed - lastSmokeSpawn >= 60 && elapsed < 4500) {
          lastSmokeSpawn = elapsed;
          for (let i = 0; i < 3; i++) {
            const arc = ctx.scene.add.circle(
              img.x + (Math.random() - 0.5) * 30,
              img.y - 10 - Math.random() * 20,
              8 + Math.random() * 16,
              0x888888, 0.4 + Math.random() * 0.3,
            ).setDepth(2);
            particles.push(arc);
            shared.allParticles.push(arc);
          }
        }
        for (const p of particles) {
          p.y -= 0.8 + Math.random() * 0.6;
          p.x += (Math.random() - 0.5) * 2;
          p.alpha -= 0.006;
          p.setScale(p.scaleX + 0.03);
          if (p.alpha <= 0) p.destroy();
        }
        for (let i = particles.length - 1; i >= 0; i--) {
          if (particles[i].alpha <= 0) particles.splice(i, 1);
        }
        // 烟雾区域内物体减速
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const d = distBetween(img.x, img.y, otherImg.x, otherImg.y);
          if (d < SLOW_RADIUS) {
            // 增加摩擦力 → 减速
            body.friction = Math.max(body.friction, 3.0);
            // 直接衰减速度（强减速效果）
            body.vx *= 0.92;
            body.vy *= 0.92;
          }
        }
      },
      cleanup: () => { particles.forEach((p) => p.destroy()); },
    };
  },

  // 12. 镜子 — 闪光致盲区域内物体随机乱走
  mirror: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    let lastFlash = 0;
    const BLIND_RADIUS = 120;
    return {
      description: '镜子闪光致盲，区域内一切物体乱走！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.alpha = 0.3 + Math.abs(Math.sin(t * 4)) * 0.7;
        img.setTint(Phaser.Display.Color.GetColor(255, 255, Math.floor(200 + Math.sin(t * 5) * 55)));
        // 闪光爆发
        if (elapsed - lastFlash >= 400) {
          lastFlash = elapsed;
          img.setScale(1 + Math.random() * 0.3);
          setTimeout(() => img.setScale(1), 80);
          // 致盲区域内物体
          for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
            const d = distBetween(img.x, img.y, otherImg.x, otherImg.y);
            if (d < BLIND_RADIUS) {
              // 随机力 = 致盲乱走
              applyImpulse(body, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 10);
              body.stunTimer = Math.max(body.stunTimer, 800);
            }
          }
        }
      },
      cleanup: () => { img.alpha = 1; img.clearTint(); img.setScale(1); },
    };
  },

  // 13. 自行车 — 高速冲刺 + 碰撞推物
  bicycle: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origX = img.x;
    const dusts: Phaser.GameObjects.Rectangle[] = [];
    let lastDust = 0;
    return {
      description: '自行车急速冲刺，撞飞一切！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.x = origX + Math.sin(t * 2) * 80;
        img.angle = Math.sin(t * 3) * 8;
        // 尾尘
        if (elapsed - lastDust >= 80) {
          lastDust = elapsed;
          const dust = ctx.scene.add.rectangle(
            img.x - 20 + (Math.random() - 0.5) * 15,
            img.y + 10 + Math.random() * 10,
            4 + Math.random() * 6, 2 + Math.random() * 3,
            0x999999, 0.5,
          ).setDepth(2);
          dusts.push(dust);
          shared.allParticles.push(dust);
        }
        for (const d of dusts) {
          d.alpha -= 0.025;
          d.x += (Math.random() - 0.5) * 2;
          if (d.alpha <= 0) d.destroy();
        }
        // 碰撞推开物体
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const dx = otherImg.x - img.x;
          const dy = otherImg.y - img.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100 && dist > 0) {
            // 自行车冲撞力
            const crashForce = 20;
            const nx = dx / dist;
            const ny = dy / dist;
            applyImpulse(body, nx * crashForce, ny * crashForce - 5);
          }
        }
      },
      cleanup: () => { img.x = origX; img.angle = 0; dusts.forEach((d) => d.destroy()); },
    };
  },

  // 14. 胶水地毯 — 粘住附近物体
  glue: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const ripples: Phaser.GameObjects.Arc[] = [];
    let lastRippleSpawn = 0;
    const GLUE_RADIUS = 80;
    return {
      description: '胶水地毯渗出黏液，粘住一切！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.setTint(Phaser.Display.Color.GetColor(255, Math.floor(150 + Math.sin(t * 3) * 60), 20));
        if (elapsed - lastRippleSpawn >= 200 && elapsed < 4500) {
          lastRippleSpawn = elapsed;
          const arc = ctx.scene.add.circle(img.x + (Math.random() - 0.5) * 50, img.y + (Math.random() - 0.5) * 15, 8, 0xf39c12, 0.3).setDepth(2);
          ripples.push(arc);
          shared.allParticles.push(arc);
        }
        for (const r of ripples) {
          r.alpha -= 0.012;
          r.setScale(r.scaleX + 0.04);
          if (r.alpha <= 0) r.destroy();
        }
        for (let i = ripples.length - 1; i >= 0; i--) {
          if (ripples[i].alpha <= 0) ripples.splice(i, 1);
        }
        // 粘住附近物体
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const d = distBetween(img.x, img.y, otherImg.x, otherImg.y);
          if (d < GLUE_RADIUS) {
            // 极高摩擦力 → 粘住
            body.friction = Math.max(body.friction, 8.0);
            // 速度急剧衰减
            body.vx *= 0.7;
            body.vy *= 0.7;
            // 冻结计时器（轻物完全粘住，重物缓慢挣脱）
            const freezeDuration = Math.max(0, 500 - body.mass * 50);
            if (freezeDuration > 0) {
              body.frozenTimer = Math.max(body.frozenTimer, freezeDuration);
            }
          }
        }
      },
      cleanup: () => { img.clearTint(); ripples.forEach((r) => r.destroy()); },
    };
  },

  // 15. 滑板 — 高速漂移 + 碰撞推物
  skateboard: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origX = img.x;
    const origY = img.y;
    const selfBody = shared.physicsBodies.get(prop.id);
    return {
      description: '滑板高速漂移，撞开一切！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.x = origX + Math.sin(t * 3.5) * 80;
        img.y = origY + Math.sin(t * 2) * 10;
        img.angle = Math.sin(t * 3.5) * 15;
        // 碰撞推开物体
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const dx = otherImg.x - img.x;
          const dy = otherImg.y - img.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80 && dist > 0) {
            const pushForce = 12;
            const nx = dx / dist;
            const ny = dy / dist;
            applyImpulse(body, nx * pushForce, ny * pushForce - 3);
            // 滑板自身被弹开（弹性碰撞）
            if (selfBody) {
              applyImpulse(selfBody, -nx * pushForce * 0.5, -ny * pushForce * 0.3);
            }
          }
        }
      },
      cleanup: () => { img.x = origX; img.y = origY; img.angle = 0; },
    };
  },

  // 16. 弹跳蘑菇 — 弹射所有落在上面的物体
  bouncyMushroom: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    const bouncedSet = new Set<string>();
    return {
      description: '弹跳蘑菇弹射一切落在上面的物体！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        const bounce = Math.abs(Math.sin(t * 4.5)) * 18;
        img.y = origY - bounce;
        img.scaleY = 1 - bounce * 0.03;
        img.scaleX = 1 + bounce * 0.03;

        // 弹射所有在上面的物体
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const dx = otherImg.x - img.x;
          const dy = otherImg.y - img.y;
          if (Math.abs(dx) < 80 && dy < 60 && dy > -100) {
            if (!bouncedSet.has(body.id)) {
              bouncedSet.add(body.id);
              // 弹射力受质量影响
              const bounceForce = 30 / body.mass;
              const direction = dx >= 0 ? 1 : -1;
              applyImpulse(body, direction * bounceForce * 0.8, -bounceForce * 1.2);
              body.stunTimer = Math.max(body.stunTimer, 400);
              // 蘑菇压缩
              img.scaleY = 0.5;
              img.scaleX = 1.5;
            }
          }
        }
        // 蘑菇恢复
        img.scaleY += (1 - img.scaleY) * 0.1;
        img.scaleX += (1 - img.scaleX) * 0.1;
      },
      cleanup: () => {
        img.y = origY; img.scaleX = 1; img.scaleY = 1;
      },
    };
  },

  // 17. 吹风机 — 定向风力推飞前方物体（轻物远重物近）
  hairDryer: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const windParticles: Phaser.GameObjects.Rectangle[] = [];
    let lastWindSpawn = 0;
    const WIND_RANGE = 250;
    const WIND_SPREAD = 80;
    return {
      description: '吹风机狂暴吹风，前方一切被吹飞！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.angle = Math.sin(t * 12) * 5;
        if (elapsed - lastWindSpawn >= 35 && elapsed < 4500) {
          lastWindSpawn = elapsed;
          for (let i = 0; i < 4; i++) {
            const rect = ctx.scene.add.rectangle(
              img.x + 20 + Math.random() * 50,
              img.y + (Math.random() - 0.5) * 20,
              5 + Math.random() * 10, 2 + Math.random() * 4,
              0xeeeeff, 0.6,
            ).setDepth(2);
            windParticles.push(rect);
            shared.allParticles.push(rect);
          }
        }
        for (const p of windParticles) {
          p.x += 5 + Math.random() * 4;
          p.alpha -= 0.016;
          if (p.alpha <= 0) p.destroy();
        }
        // 吹飞前方所有物体
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const dx = otherImg.x - img.x;
          const dy = otherImg.y - img.y;
          // 前方锥形区域
          if (dx > -20 && dx < WIND_RANGE && Math.abs(dy) < WIND_SPREAD) {
            // 风力持续施加（力除以质量 → 轻物吹远重物微偏）
            const windForce = 6;
            applyForce(body, windForce, (Math.random() - 0.5) * 1.5);
          }
        }
      },
      cleanup: () => {
        img.angle = 0;
        windParticles.forEach((p) => p.destroy());
      },
    };
  },

  // 18. 反向重力区 — 浮空所有物体（轻物快重物慢）
  reverseGravity: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const FLOAT_RADIUS = 200;
    return {
      description: '反向重力区启动，一切物体猛烈浮空！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.setTint(Phaser.Display.Color.GetColor(80, 140, 255));
        img.angle += 2;
        // 浮空所有区域内的物体
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const d = distBetween(img.x, img.y, otherImg.x, otherImg.y);
          if (d < FLOAT_RADIUS) {
            // 反重力浮力（力除以质量 → 轻物先浮起重物慢浮）
            const liftForce = 8;
            applyForce(body, Math.cos(t * 4 + d) * 2, -liftForce);
            otherImg.angle += 1.5;
          }
        }
      },
      cleanup: () => {
        img.clearTint(); img.angle = 0;
      },
    };
  },

  // 19. 假天花板 — 下压推力
  fakeCeiling: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    const origX = img.x;
    const PRESS_RADIUS = 150;
    return {
      description: '假天花板剧烈下压，压扁下方一切！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        const pressAmount = Math.sin(t * 2) * 25;
        img.y = origY + pressAmount;
        img.x = origX + (Math.random() - 0.5) * 3;
        img.alpha = 0.5 + Math.sin(t * 3) * 0.4;
        img.setTint(Phaser.Display.Color.GetColor(200, 200, 200));
        img.setScale(1 + Math.sin(t * 2) * 0.08);

        // 下压推力：下方物体被压
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const dx = otherImg.x - img.x;
          const dy = otherImg.y - img.y;
          if (Math.abs(dx) < PRESS_RADIUS && dy > 0 && dy < 200) {
            // 下压力 + 自身重量
            const pressForce = 12 + Math.abs(pressAmount) * 0.3;
            applyForce(body, (Math.random() - 0.5) * 1, pressForce);
            // 轻物被压扁效果
            if (body.mass < 2 && pressAmount > 10) {
              otherImg.setScale(otherImg.scaleX, Math.max(0.5, otherImg.scaleY - 0.002));
            }
          }
        }
      },
      cleanup: () => { img.y = origY; img.x = origX; img.alpha = 1; img.clearTint(); img.setScale(1); },
    };
  },

  // 20. 旋转舞台 — 离心力甩出附近物体
  rotatingStage: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const SPIN_RADIUS = 120;
    return {
      description: '旋转舞台高速转动，离心力甩出一切！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.angle += 3;
        img.setTint(Phaser.Display.Color.GetColor(80, 80, 200));
        img.setScale(1 + Math.sin(t * 3) * 0.1);

        // 离心力：甩出附近物体
        for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
          const dx = otherImg.x - img.x;
          const dy = otherImg.y - img.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < SPIN_RADIUS && dist > 0) {
            // 切线方向力（垂直于半径方向）+ 离心力（沿半径方向向外）
            const nx = dx / dist;
            const ny = dy / dist;
            // 切线方向（逆时针旋转）
            const tx = -ny;
            const ty = nx;
            // 越靠边缘离心力越大
            const edgeFactor = dist / SPIN_RADIUS;
            const centrifugalForce = 10 * edgeFactor;
            const tangentialForce = 5 * edgeFactor;
            applyForce(body, nx * centrifugalForce + tx * tangentialForce, ny * centrifugalForce + ty * tangentialForce);
          }
        }
      },
      cleanup: () => { img.angle = 0; img.clearTint(); img.setScale(1); },
    };
  },

  // 21. 百变许愿机 — 随机力场
  wishMachine: (prop, ctx, shared) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const stars: Phaser.GameObjects.Star[] = [];
    const sparkles: SparkleParticle[] = [];
    let lastStarSpawn = 0;
    let lastSparkleSpawn = 0;
    let lastRandomForce = 0;
    const baseW = img.displayWidth;
    const baseH = img.displayHeight;
    const CHAOS_RADIUS = 120;
    return {
      description: '百变许愿机随机施加力场，全场混乱！',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.angle += 3 + elapsed * 0.002;
        const hue = (elapsed * 60) % 360;
        const color = Phaser.Display.Color.HSLToColor(hue / 360, 0.8, 0.6).color;
        img.setTint(color);
        const pulse = 1 + Math.sin(t * 5) * 0.3;
        img.setDisplaySize(baseW * pulse, baseH * pulse);
        img.y += Math.sin(t * 3) * 0.8;

        // 随机力场（每500ms变化一次）
        if (elapsed - lastRandomForce >= 500) {
          lastRandomForce = elapsed;
          for (const { body, img: otherImg } of getOtherBodies(prop.id, shared, ctx)) {
            const d = distBetween(img.x, img.y, otherImg.x, otherImg.y);
            if (d < CHAOS_RADIUS) {
              // 随机方向随机大小的力
              const angle = Math.random() * Math.PI * 2;
              const force = 5 + Math.random() * 15;
              applyImpulse(body, Math.cos(angle) * force, Math.sin(angle) * force);
            }
          }
        }

        // 星光粒子
        if (elapsed - lastStarSpawn >= 60 && elapsed < 4500) {
          lastStarSpawn = elapsed;
          const angle = Math.random() * Math.PI * 2;
          const dist = 25 + Math.random() * 35;
          const star = ctx.scene.add.star(
            img.x + Math.cos(angle) * dist,
            img.y + Math.sin(angle) * dist,
            5, 2 + Math.random() * 6, 6 + Math.random() * 8,
            Phaser.Display.Color.GetColor(200 + Math.floor(Math.random() * 55), 150 + Math.floor(Math.random() * 100), 255),
            0.9,
          ).setDepth(6);
          stars.push(star);
          shared.allParticles.push(star);
        }
        // 光圈
        if (elapsed - lastSparkleSpawn >= 100 && elapsed < 4500) {
          lastSparkleSpawn = elapsed;
          for (let i = 0; i < 3; i++) {
            const ang = (Math.PI * 2 / 3) * i + t * 2;
            const sparkle = ctx.scene.add.circle(
              img.x, img.y, 3,
              Phaser.Display.Color.GetColor(255, 220, 100),
              0.7,
            ).setDepth(4) as SparkleParticle;
            sparkle.targetX = img.x + Math.cos(ang) * (50 + Math.random() * 30);
            sparkle.targetY = img.y + Math.sin(ang) * (50 + Math.random() * 30);
            sparkle.progress = 0;
            sparkles.push(sparkle);
            shared.allParticles.push(sparkle);
          }
        }
        for (const s of stars) {
          s.angle += 5;
          s.alpha -= 0.01;
          s.setScale(Math.max(0.01, s.scaleX - 0.005));
          if (s.alpha <= 0) s.destroy();
        }
        for (let i = stars.length - 1; i >= 0; i--) {
          if (stars[i].alpha <= 0) stars.splice(i, 1);
        }
        for (const sp of sparkles) {
          const p = sp.progress + 0.03;
          sp.progress = p;
          sp.x = img.x + (sp.targetX - img.x) * p;
          sp.y = img.y + (sp.targetY - img.y) * p;
          sp.alpha = 0.7 * (1 - p);
          sp.setScale(1 + p * 2);
          if (p >= 1) sp.destroy();
        }
        for (let i = sparkles.length - 1; i >= 0; i--) {
          if (!sparkles[i].active || sparkles[i].progress >= 1) sparkles.splice(i, 1);
        }
        if (elapsed > 4500) {
          const flashIntensity = (elapsed - 4500) / 500;
          img.setAlpha(0.7 + Math.sin(elapsed * 0.05) * 0.3 * flashIntensity);
        }
      },
      cleanup: () => {
        img.angle = 0;
        img.setDisplaySize(baseW, baseH);
        img.clearTint();
        img.setAlpha(1);
        stars.forEach(safeDestroy);
        sparkles.forEach(safeDestroy);
      },
    };
  },
};

// ============================================================
// 执行所有效果
// ============================================================
export function executeAllEffects(
  placedProps: PlacedProp[],
  ctx: EffectContext,
  duration: number = 5000,
): string[] {
  const descriptions: string[] = [];
  const ticks: ((elapsed: number) => void)[] = [];
  const cleanups: (() => void)[] = [];

  // 初始化物理体映射
  const physicsBodies = new Map<string, PhysicsBody>();
  for (const prop of placedProps) {
    physicsBodies.set(prop.id, createBody(prop.id, prop.type));
  }

  const shared: SharedState = {
    physicsBodies,
    allParticles: [],
  };

  debugLog(`[PropEffect] 初始化: ${placedProps.length} 个道具, duration=${duration}ms`);

  for (const prop of placedProps) {
    const effectFn = EFFECT_REGISTRY[prop.type];
    if (!effectFn) {
      debugLog(`[PropEffect]   道具 ${prop.id} (${prop.type}): 无注册效果，跳过`);
      continue;
    }

    const result = effectFn(prop, ctx, shared);
    if (result) {
      descriptions.push(`[${PROP_MANIFEST[prop.type].label}] ${result.description}`);
      ticks.push(result.tick);
      cleanups.push(result.cleanup);
      debugLog(`[PropEffect]   道具 ${prop.id} (${prop.type}): 效果已注册`);
    } else {
      debugLog(`[PropEffect]   道具 ${prop.id} (${prop.type}): imageMap中未找到，跳过`);
    }
  }

  debugLog(`[PropEffect] 总计: ${ticks.length} 个tick, ${cleanups.length} 个cleanup`);

  // 统一主循环：两阶段 tick
  if (ticks.length > 0) {
    const startTime = ctx.scene.time.now;
    let frameCount = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        frameCount++;
        const elapsed = ctx.scene.time.now - startTime;

        // === 阶段1：各道具效果 tick（施加力，不直接移动） ===
        for (let i = 0; i < ticks.length; i++) {
          try {
            ticks[i](elapsed);
          } catch (e) {
            console.error(`[PropEffect] tick[${i}] 异常 (frame=${frameCount} elapsed=${elapsed}ms):`, e);
          }
        }

        // === 阶段2：统一物理积分（力→速度→位置→碰撞→地面） ===
        try {
          integratePhysics(physicsBodies, ctx.imageMap, ctx.canvasBottom, ctx.canvasLeft, ctx.canvasRight, ctx.cliffPlatformY);
          resolveCollisions(physicsBodies, ctx.imageMap);
        } catch (e) {
          console.error('[PropEffect] 物理积分异常:', e);
        }

        // === 阶段3：场景效果覆盖（悬崖掉落等） ===
        if (ctx.onPostTick) {
          try {
            ctx.onPostTick();
          } catch (e) {
            console.error('[PropEffect] onPostTick 异常:', e);
          }
        }
      },
    });

    debugLog(`[PropEffect] 主循环已启动 (delay=16ms), 将在 ${duration}ms 后清理`);

    ctx.scene.time.delayedCall(duration, () => {
      debugLog(`[PropEffect] 清理开始: 共 ${frameCount} 帧, 耗时 ${ctx.scene.time.now - startTime}ms`);
      timer.destroy();
      for (let i = 0; i < cleanups.length; i++) {
        try {
          cleanups[i]();
        } catch (e) {
          console.error(`[PropEffect] cleanup[${i}] 异常:`, e);
        }
      }
      // 清理所有残留粒子
      shared.allParticles.forEach((p) => {
        if (p && p.active) p.destroy();
      });
      debugLog(`[PropEffect] 清理完成`);
    });
  } else {
    debugLog(`[PropEffect] 无效果需要执行，跳过`);
  }

  return descriptions;
}
