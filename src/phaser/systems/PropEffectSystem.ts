// ============================================================
// PropEffectSystem — 20 个道具专属物理效果（3秒动画）
// 在"开始表演"时执行，展示道具之间的物理互动
// 优化：所有效果合并到一个 16ms 主循环，减少定时器数量
// ============================================================

import Phaser from 'phaser';
import type { PlacedProp } from '@/types';
import { PROP_MANIFEST } from '../assets/manifest';
import type { PropKey } from '../assets/manifest';

const DEBUG_PROP_EFFECTS = import.meta.env.DEV;

function debugLog(...args: unknown[]): void {
  if (DEBUG_PROP_EFFECTS) console.log(...args);
}

export interface EffectContext {
  scene: Phaser.Scene;
  /** 所有已放置道具的 Image 引用 (key: prop.id) */
  imageMap: Map<string, Phaser.GameObjects.Image>;
}

interface EffectResult {
  /** 效果描述文本 */
  description: string;
  /** 每帧更新函数 */
  tick: (elapsed: number) => void;
  /** 效果执行期间创建的特效对象（动画结束后自动清理） */
  cleanup: () => void;
}

/**
 * 单个道具的专属效果
 * 返回 EffectResult，包含描述、每帧更新和清理函数
 */
type PropEffectFn = (prop: PlacedProp, ctx: EffectContext) => EffectResult | null;

/**
 * 效果注册表：每个道具 key 对应一个效果函数
 * 优化：tick 函数由统一主循环调用，不再各自创建定时器
 */
const EFFECT_REGISTRY: Partial<Record<PropKey, PropEffectFn>> = {

  // 1. 香蕉皮 — 弹跳动画
  banana: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    return {
      description: '香蕉皮在地上弹跳摇晃',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.y = origY - Math.abs(Math.sin(t * 3)) * 8;
        img.angle = Math.sin(t * 4) * 10;
      },
      cleanup: () => { img.y = origY; img.angle = 0; },
    };
  },

  // 2. 传送门 — 旋转 + 缩放脉冲
  portal: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    return {
      description: '传送门旋转扭曲，发出紫色光晕',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.angle += 2;
        img.setScale(1 + Math.sin(t * 2) * 0.15);
        img.alpha = 0.6 + Math.sin(t * 3) * 0.4;
      },
      cleanup: () => { img.angle = 0; img.setScale(1); img.alpha = 1; },
    };
  },

  // 3. 弹射板 — 上下弹跳
  trampoline: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    return {
      description: '弹射板上下压缩弹跳',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.y = origY + Math.sin(t * 3) * 5;
        img.scaleY = 1 + Math.sin(t * 3) * 0.2;
      },
      cleanup: () => { img.y = origY; img.scaleY = 1; },
    };
  },

  // 4. 定时炸弹 — 抖动 + 红光闪烁
  bomb: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    return {
      description: '炸弹剧烈抖动，红光急速闪烁',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.x += (Math.random() - 0.5) * 3;
        img.y += (Math.random() - 0.5) * 3;
        img.setTint(Phaser.Display.Color.GetColor(
          255,
          Math.floor(100 + Math.sin(t * 5) * 80),
          Math.floor(80 + Math.sin(t * 5) * 60),
        ));
      },
      cleanup: () => { img.clearTint(); },
    };
  },

  // 5. 爆炸桶 — 膨胀 + 抖动
  barrel: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origScale = img.scaleX;
    return {
      description: '爆炸桶膨胀鼓动，随时要炸',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        const s = 1 + Math.abs(Math.sin(t * 2.5)) * 0.25;
        img.setScale(s);
        img.x += (Math.random() - 0.5) * 2;
        img.setTint(Phaser.Display.Color.GetColor(255, Math.floor(180 - Math.sin(t * 4) * 60), 0));
      },
      cleanup: () => { img.setScale(origScale); img.clearTint(); },
    };
  },

  // 6. 呆萌 NPC — 左右摇晃 + 轻微弹跳
  clumsyNpc: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    return {
      description: '呆萌NPC摇摇晃晃，站不稳',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.angle = Math.sin(t * 2) * 8;
        img.y = origY + Math.sin(t * 3) * 3;
      },
      cleanup: () => { img.angle = 0; img.y = origY; },
    };
  },

  // 7. 咖啡杯 — 旋转 + 微小抖动
  coffeeCup: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    return {
      description: '咖啡杯微微颤抖，热咖啡溅出',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.angle = Math.sin(t * 3) * 5;
        img.x += (Math.random() - 0.5) * 0.8;
      },
      cleanup: () => { img.angle = 0; },
    };
  },

  // 8. 弹簧拳套 — 伸缩弹拳动画
  springGlove: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    return {
      description: '弹簧拳套猛烈伸缩出拳',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.scaleX = 1 + Math.abs(Math.sin(t * 4)) * 0.4;
        img.x += Math.sin(t * 4) * 3;
      },
      cleanup: () => { img.scaleX = 1; },
    };
  },

  // 9. 喷气背包 — 上升 + 火焰粒子效果
  jetpack: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;

    // 火焰粒子（使用对象池减少 GC）
    const particles: Phaser.GameObjects.Rectangle[] = [];
    let lastFlameSpawn = 0;

    return {
      description: '喷气背包点火升空，火焰喷射',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.y = origY - Math.min(t * 20, 40);
        img.angle = Math.sin(t * 5) * 3;

        // 每 80ms 生成火焰（替代独立定时器）
        if (elapsed - lastFlameSpawn >= 80 && elapsed < 2800) {
          lastFlameSpawn = elapsed;
          for (let i = 0; i < 3; i++) {
            const rect = ctx.scene.add.rectangle(
              img.x + (Math.random() - 0.5) * 10,
              img.y + img.displayHeight / 2 + Math.random() * 10,
              4 + Math.random() * 4,
              6 + Math.random() * 6,
              Phaser.Display.Color.GetColor(
                255,
                Math.floor(100 + Math.random() * 155),
                Math.floor(Math.random() * 50),
              ),
            ).setAlpha(0.8).setDepth(3);
            particles.push(rect);
          }
        }

        // 粒子上升消散
        for (const p of particles) {
          p.y -= 2;
          p.alpha -= 0.03;
          if (p.alpha <= 0) p.destroy();
        }
        // 清理已销毁的粒子引用
        for (let i = particles.length - 1; i >= 0; i--) {
          if (particles[i].alpha <= 0) particles.splice(i, 1);
        }
      },
      cleanup: () => {
        img.y = origY; img.angle = 0;
        particles.forEach((p) => p.destroy());
      },
    };
  },

  // 10. 磁铁地板 — 吸引周围道具
  magnet: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const pullTargets: { img: Phaser.GameObjects.Image; origX: number; origY: number }[] = [];

    // 找到磁铁附近的道具
    ctx.imageMap.forEach((otherImg, otherId) => {
      if (otherId === prop.id) return;
      const dx = otherImg.x - img.x;
      const dy = otherImg.y - img.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 250) {
        pullTargets.push({ img: otherImg, origX: otherImg.x, origY: otherImg.y });
      }
    });

    return {
      description: '磁铁地板发出蓝光，吸引周围道具',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.angle = Math.sin(t * 3) * 5;
        img.setTint(Phaser.Display.Color.GetColor(180, 180, Math.floor(180 + Math.sin(t * 4) * 75)));

        // 吸引周围道具
        for (const target of pullTargets) {
          const dx = img.x - target.img.x;
          const dy = img.y - target.img.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = Math.min(2, 80 / dist);
          target.img.x += (dx / dist) * force;
          target.img.y += (dy / dist) * force;
        }
      },
      cleanup: () => {
        img.angle = 0; img.clearTint();
        pullTargets.forEach((t) => { t.img.x = t.origX; t.img.y = t.origY; });
      },
    };
  },

  // 11. 烟雾机 — 烟雾粒子扩散
  smokeMachine: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const particles: Phaser.GameObjects.Arc[] = [];
    let lastSmokeSpawn = 0;

    return {
      description: '烟雾机喷出滚滚浓烟，笼罩舞台',
      tick: (elapsed) => {
        // 每 100ms 生成烟雾（替代独立定时器）
        if (elapsed - lastSmokeSpawn >= 100 && elapsed < 2800) {
          lastSmokeSpawn = elapsed;
          const arc = ctx.scene.add.circle(
            img.x + (Math.random() - 0.5) * 20,
            img.y - 10 - Math.random() * 15,
            6 + Math.random() * 10,
            0xcccccc,
            0.5 + Math.random() * 0.3,
          ).setDepth(2);
          particles.push(arc);
        }

        for (const p of particles) {
          p.y -= 0.6 + Math.random() * 0.4;
          p.x += (Math.random() - 0.5) * 1.5;
          p.alpha -= 0.008;
          p.setScale(p.scaleX + 0.02);
          if (p.alpha <= 0) p.destroy();
        }
        // 清理已销毁粒子
        for (let i = particles.length - 1; i >= 0; i--) {
          if (particles[i].alpha <= 0) particles.splice(i, 1);
        }
      },
      cleanup: () => { particles.forEach((p) => p.destroy()); },
    };
  },

  // 12. 镜子 — 翻转闪烁
  mirror: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    return {
      description: '镜子闪烁反光，映出倒影',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.alpha = 0.4 + Math.abs(Math.sin(t * 3)) * 0.6;
        img.setTint(Phaser.Display.Color.GetColor(
          Math.floor(200 + Math.sin(t * 4) * 55),
          Math.floor(200 + Math.cos(t * 4) * 55),
          255,
        ));
      },
      cleanup: () => { img.alpha = 1; img.clearTint(); },
    };
  },

  // 13. 自行车 — 向前移动 + 轮子旋转
  bicycle: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origX = img.x;
    return {
      description: '自行车来回骑行，轮子飞转',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.x = origX + Math.sin(t * 1.5) * 40;
        img.angle = Math.sin(t * 2) * 5;
        img.y += Math.sin(t * 3) * 1.5;
      },
      cleanup: () => { img.x = origX; img.angle = 0; },
    };
  },

  // 14. 胶水地毯 — 黏住效果（周围道具减速）
  glue: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const ripples: Phaser.GameObjects.Arc[] = [];
    let lastRippleSpawn = 0;

    return {
      description: '胶水地毯渗出黏稠液体，粘住路过道具',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.setTint(Phaser.Display.Color.GetColor(255, Math.floor(180 + Math.sin(t * 3) * 40), 30));

        // 每 300ms 生成涟漪
        if (elapsed - lastRippleSpawn >= 300 && elapsed < 2500) {
          lastRippleSpawn = elapsed;
          const arc = ctx.scene.add.circle(
            img.x + (Math.random() - 0.5) * 30,
            img.y + (Math.random() - 0.5) * 8,
            5,
            0xf39c12,
            0.3,
          ).setDepth(2);
          ripples.push(arc);
        }

        for (const r of ripples) {
          r.alpha -= 0.01;
          r.setScale(r.scaleX + 0.03);
          if (r.alpha <= 0) r.destroy();
        }
        for (let i = ripples.length - 1; i >= 0; i--) {
          if (ripples[i].alpha <= 0) ripples.splice(i, 1);
        }
      },
      cleanup: () => { img.clearTint(); ripples.forEach((r) => r.destroy()); },
    };
  },

  // 15. 滑板 — 左右滑动
  skateboard: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origX = img.x;
    return {
      description: '滑板快速左右滑行',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.x = origX + Math.sin(t * 2.5) * 50;
        img.angle = Math.sin(t * 2.5) * 8;
      },
      cleanup: () => { img.x = origX; img.angle = 0; },
    };
  },

  // 16. 弹跳蘑菇 — 弹跳压缩
  bouncyMushroom: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    return {
      description: '弹跳蘑菇一弹一弹，充满弹性',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        const bounce = Math.abs(Math.sin(t * 3.5)) * 10;
        img.y = origY - bounce;
        img.scaleY = 1 - bounce * 0.02;
        img.scaleX = 1 + bounce * 0.02;
      },
      cleanup: () => { img.y = origY; img.scaleX = 1; img.scaleY = 1; },
    };
  },

  // 17. 吹风机 — 吹风粒子 + 推动前方道具
  hairDryer: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const windParticles: Phaser.GameObjects.Rectangle[] = [];
    let lastWindSpawn = 0;

    // 推动前方道具（吹风机朝向右边）
    const pushTargets: { img: Phaser.GameObjects.Image; origX: number; origY: number }[] = [];
    ctx.imageMap.forEach((otherImg, otherId) => {
      if (otherId === prop.id) return;
      const dx = otherImg.x - img.x;
      const dy = otherImg.y - img.y;
      if (dx > 0 && dx < 200 && Math.abs(dy) < 60) {
        pushTargets.push({ img: otherImg, origX: otherImg.x, origY: otherImg.y });
      }
    });

    return {
      description: '吹风机呼呼吹风，把前方道具吹跑',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.angle = Math.sin(t * 8) * 2;

        // 每 50ms 生成风粒子
        if (elapsed - lastWindSpawn >= 50 && elapsed < 2800) {
          lastWindSpawn = elapsed;
          const rect = ctx.scene.add.rectangle(
            img.x + 12 + Math.random() * 30,
            img.y + (Math.random() - 0.5) * 10,
            3 + Math.random() * 5,
            1 + Math.random() * 2,
            0xeeeeff,
            0.4 + Math.random() * 0.3,
          ).setDepth(2);
          windParticles.push(rect);
        }

        for (const p of windParticles) {
          p.x += 3 + Math.random() * 2;
          p.alpha -= 0.015;
          if (p.alpha <= 0) p.destroy();
        }
        for (let i = windParticles.length - 1; i >= 0; i--) {
          if (windParticles[i].alpha <= 0) windParticles.splice(i, 1);
        }

        for (const target of pushTargets) {
          target.img.x += 1.5 + Math.random() * 0.5;
          target.img.y += (Math.random() - 0.5) * 1;
        }
      },
      cleanup: () => {
        img.angle = 0;
        windParticles.forEach((p) => p.destroy());
        pushTargets.forEach((t) => { t.img.x = t.origX; t.img.y = t.origY; });
      },
    };
  },

  // 18. 反向重力区 — 道具上浮
  reverseGravity: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;

    // 让周围道具上浮
    const floatTargets: { img: Phaser.GameObjects.Image; origX: number; origY: number }[] = [];
    ctx.imageMap.forEach((otherImg, otherId) => {
      if (otherId === prop.id) return;
      const dx = otherImg.x - img.x;
      const dy = otherImg.y - img.y;
      if (Math.abs(dx) < 180 && Math.abs(dy) < 180) {
        floatTargets.push({ img: otherImg, origX: otherImg.x, origY: otherImg.y });
      }
    });

    return {
      description: '反向重力区启动，道具缓缓飘浮起来',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.setTint(Phaser.Display.Color.GetColor(
          Math.floor(80 + Math.sin(t * 3) * 40),
          Math.floor(80 + Math.sin(t * 3) * 40),
          255,
        ));
        for (const target of floatTargets) {
          target.img.y -= 0.5 + Math.sin(t + parseFloat(target.img.name || '0')) * 0.3;
          target.img.x += Math.cos(t * 2) * 0.3;
          target.img.angle += 0.3;
        }
      },
      cleanup: () => {
        img.clearTint();
        floatTargets.forEach((t) => { t.img.x = t.origX; t.img.y = t.origY; t.img.angle = 0; });
      },
    };
  },

  // 19. 假天花板 — 下压 + 震荡
  fakeCeiling: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    return {
      description: '假天花板缓缓下压，震得舞台发颤',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.y = origY + Math.sin(t * 1.5) * 15;
        img.alpha = 0.6 + Math.sin(t * 2) * 0.3;
        img.setTint(Phaser.Display.Color.GetColor(
          Math.floor(180 + Math.sin(t * 3) * 40),
          Math.floor(180 + Math.sin(t * 3) * 40),
          Math.floor(180 + Math.sin(t * 3) * 40),
        ));
      },
      cleanup: () => { img.y = origY; img.alpha = 1; img.clearTint(); },
    };
  },

  // 20. 旋转舞台 — 旋转
  rotatingStage: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    return {
      description: '旋转舞台缓缓转动，带动场景变换',
      tick: (elapsed) => {
        const t = elapsed * 0.001;
        img.angle += 1.5;
        img.setTint(Phaser.Display.Color.GetColor(
          Math.floor(50 + Math.sin(t * 2) * 30),
          Math.floor(50 + Math.sin(t * 2) * 30),
          Math.floor(80 + Math.sin(t * 2) * 40),
        ));
      },
      cleanup: () => { img.angle = 0; img.clearTint(); },
    };
  },
};

/**
 * 对场景中所有已放置道具执行专属物理效果，持续指定时长
 * 优化：所有效果合并到一个 16ms 主循环（单一定时器），替代 N+个独立定时器
 * 返回效果描述文本汇总
 */
export function executeAllEffects(
  placedProps: PlacedProp[],
  ctx: EffectContext,
  duration: number = 3000,
): string[] {
  const descriptions: string[] = [];
  const ticks: ((elapsed: number) => void)[] = [];
  const cleanups: (() => void)[] = [];

  debugLog(`[PropEffect] 初始化: ${placedProps.length} 个道具, duration=${duration}ms`);

  for (const prop of placedProps) {
    const effectFn = EFFECT_REGISTRY[prop.type];
    if (!effectFn) {
      debugLog(`[PropEffect]   道具 ${prop.id} (${prop.type}): 无注册效果，跳过`);
      continue;
    }

    const result = effectFn(prop, ctx);
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

  // 统一主循环：单一 16ms 定时器驱动所有效果
  if (ticks.length > 0) {
    const startTime = ctx.scene.time.now;
    let frameCount = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        frameCount++;
        const elapsed = ctx.scene.time.now - startTime;
        for (let i = 0; i < ticks.length; i++) {
          try {
            ticks[i](elapsed);
          } catch (e) {
            console.error(`[PropEffect] tick[${i}] 异常 (frame=${frameCount} elapsed=${elapsed}ms):`, e);
          }
        }
      },
    });

    debugLog(`[PropEffect] 主循环已启动 (delay=16ms), 将在 ${duration}ms 后清理`);

    // duration 毫秒后清理所有效果
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
      debugLog(`[PropEffect] 清理完成`);
    });
  } else {
    debugLog(`[PropEffect] 无效果需要执行，跳过`);
  }

  return descriptions;
}
