// ============================================================
// PhysicsEngine — 轻量级物理积分引擎（F=ma）
// 每帧流程：道具效果施力 → 统一物理积分 → 碰撞检测 → 地形效果
// ============================================================

import type { PhysicsBody } from '@/types';
import { PROP_MASS, type PropKey } from '../assets/manifest';

/** 物理常量 */
export const PHY = {
  /** 重力加速度 (px/frame²) */
  GRAVITY: 0.3,
  /** 最大下落速度 (px/frame) */
  MAX_FALL: 14,
  /** 最大水平速度 (px/frame) */
  MAX_VX: 20,
  /** 最大上升速度 (px/frame) */
  MAX_VY_UP: -20,
  /** 地面反弹系数 */
  BOUNCE: 0.35,
  /** 速度低于此值时停止弹跳 */
  MIN_BOUNCE: 0.5,
  /** 默认摩擦力（1.0=正常） */
  DEFAULT_FRICTION: 1.0,
  /** 速度衰减系数（空气阻力） */
  AIR_DRAG: 0.995,
  /** 地面摩擦衰减 */
  GROUND_FRICTION: 0.92,
} as const;

/** 创建一个物理体 */
export function createBody(id: string, type: PropKey): PhysicsBody {
  return {
    id,
    type,
    mass: PROP_MASS[type],
    vx: 0,
    vy: 0,
    fx: 0,
    fy: 0,
    grounded: false,
    frozenTimer: 0,
    stunTimer: 0,
    friction: PHY.DEFAULT_FRICTION,
  };
}

/** 对物理体施加力（力会被质量除，产生加速度） */
export function applyForce(body: PhysicsBody, fx: number, fy: number): void {
  // 无限质量 = 固定位置，不受力
  if (!isFinite(body.mass) || body.mass <= 0) return;
  // 被冻住不受力
  if (body.frozenTimer > 0) return;
  body.fx += fx;
  body.fy += fy;
}

/** 施加冲量（直接改变速度，但仍受质量影响） */
export function applyImpulse(body: PhysicsBody, ix: number, iy: number): void {
  if (!isFinite(body.mass) || body.mass <= 0) return;
  if (body.frozenTimer > 0) return;
  body.vx += ix / body.mass;
  body.vy += iy / body.mass;
}

/** 两点间距离 */
export function distBetween(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 统一物理积分：一帧内完成力→加速度→速度→位置 */
export function integratePhysics(
  bodies: Map<string, PhysicsBody>,
  images: Map<string, Phaser.GameObjects.Image>,
  canvasBottom: number,
  canvasLeft: number,
  canvasRight: number,
  cliffPlatformY?: number,
): void {
  // 悬崖模式：平台地面Y作为实际地面，道具不可穿过蓝线
  const effectiveGroundY = cliffPlatformY ?? canvasBottom;
  for (const [id, body] of bodies) {
    const img = images.get(id);
    if (!img || !img.active) continue;
    // 无限质量 = 固定位置，清除力后跳过
    if (!isFinite(body.mass)) {
      body.fx = 0;
      body.fy = 0;
      continue;
    }

    // 被冻住：速度衰减，不清除力（让冻结解除后力能自然消散）
    if (body.frozenTimer > 0) {
      body.frozenTimer -= 16; // 约16ms一帧
      body.vx *= 0.8;
      body.vy *= 0.8;
      body.fx = 0;
      body.fy = 0;
      if (Math.abs(body.vx) < 0.1) body.vx = 0;
      if (Math.abs(body.vy) < 0.1) body.vy = 0;
    } else {
      // F=ma: 加速度 = 力 / 质量
      const ax = body.fx / body.mass;
      const ay = body.fy / body.mass;
      body.vx += ax;
      body.vy += ay;
    }

    // 重力
    body.vy += PHY.GRAVITY;

    // 速度上限
    body.vy = Math.min(body.vy, PHY.MAX_FALL);
    body.vy = Math.max(body.vy, PHY.MAX_VY_UP);
    body.vx = Math.max(-PHY.MAX_VX, Math.min(PHY.MAX_VX, body.vx));

    // 空气阻力
    body.vx *= PHY.AIR_DRAG;
    body.vy *= PHY.AIR_DRAG;

    // 地面摩擦（在地面上时水平速度衰减更快）
    if (body.grounded) {
      // friction>1 = 更多摩擦（胶水区），friction<1 = 更少摩擦（滑行区）
      const frictionDecay = PHY.GROUND_FRICTION / body.friction;
      body.vx *= Math.max(0, Math.min(1, frictionDecay));
    }

    // 更新位置
    img.x += body.vx;
    img.y += body.vy;

    // 旋转：速度越大旋转越快
    if (Math.abs(body.vx) > 1 || Math.abs(body.vy) > 1) {
      img.angle += body.vx * 0.3;
    }

    // 眩晕：随机偏移
    if (body.stunTimer > 0) {
      body.stunTimer -= 16;
      img.x += (Math.random() - 0.5) * 3;
      img.y += (Math.random() - 0.5) * 2;
      img.angle += (Math.random() - 0.5) * 5;
    }

    // 地面碰撞（悬崖模式下 effectiveGroundY = 平台蓝线高度）
    const groundY = effectiveGroundY - img.displayHeight / 2 - 8;
    if (img.y >= groundY) {
      img.y = groundY;
      if (body.vy > 0) {
        body.vy = -body.vy * PHY.BOUNCE;
        if (Math.abs(body.vy) < PHY.MIN_BOUNCE) {
          body.vy = 0;
          body.grounded = true;
        }
      }
    } else {
      body.grounded = false;
    }

    // 左右边界反弹
    const halfW = img.displayWidth / 2;
    if (img.x - halfW < canvasLeft) {
      img.x = canvasLeft + halfW;
      body.vx = Math.abs(body.vx) * 0.5;
    }
    if (img.x + halfW > canvasRight) {
      img.x = canvasRight - halfW;
      body.vx = -Math.abs(body.vx) * 0.5;
    }

    // 清除已施加的力（下帧重新累积）
    body.fx = 0;
    body.fy = 0;

    // 摩擦力逐渐恢复（被香蕉皮/胶水改变的摩擦力在效果结束后恢复）
    if (body.friction !== PHY.DEFAULT_FRICTION) {
      body.friction += (PHY.DEFAULT_FRICTION - body.friction) * 0.02;
      if (Math.abs(body.friction - PHY.DEFAULT_FRICTION) < 0.05) {
        body.friction = PHY.DEFAULT_FRICTION;
      }
    }
  }
}

/** 道具间碰撞检测与响应（弹性碰撞） */
export function resolveCollisions(
  bodies: Map<string, PhysicsBody>,
  images: Map<string, Phaser.GameObjects.Image>,
): void {
  const entries = Array.from(bodies.entries());
  for (let i = 0; i < entries.length; i++) {
    const [idA, bodyA] = entries[i];
    const imgA = images.get(idA);
    if (!imgA || !imgA.active || !isFinite(bodyA.mass)) continue;

    for (let j = i + 1; j < entries.length; j++) {
      const [idB, bodyB] = entries[j];
      const imgB = images.get(idB);
      if (!imgB || !imgB.active || !isFinite(bodyB.mass)) continue;

      const dx = imgB.x - imgA.x;
      const dy = imgB.y - imgA.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // 碰撞半径 = 两道具的显示宽度之和的40%
      const minDist = (imgA.displayWidth + imgB.displayWidth) * 0.2;
      if (dist < minDist && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;

        // 分离（推开重叠）
        const overlap = minDist - dist;
        const totalMass = bodyA.mass + bodyB.mass;
        imgA.x -= nx * overlap * (bodyB.mass / totalMass);
        imgA.y -= ny * overlap * (bodyB.mass / totalMass);
        imgB.x += nx * overlap * (bodyA.mass / totalMass);
        imgB.y += ny * overlap * (bodyA.mass / totalMass);

        // 弹性碰撞：交换沿碰撞法线方向的速度分量
        const dvx = bodyA.vx - bodyB.vx;
        const dvy = bodyA.vy - bodyB.vy;
        const dvDotN = dvx * nx + dvy * ny;
        // 只在接近时才碰撞（避免物体已经分开时还施加力）
        if (dvDotN > 0) {
          const restitution = 0.6; // 碰撞恢复系数
          const impulse = (2 * dvDotN * restitution) / totalMass;
          bodyA.vx -= impulse * bodyB.mass * nx;
          bodyA.vy -= impulse * bodyB.mass * ny;
          bodyB.vx += impulse * bodyA.mass * nx;
          bodyB.vy += impulse * bodyA.mass * ny;
        }
      }
    }
  }
}
