// ============================================================
// PropEffectSystem — 20 个道具专属物理效果（3秒动画）
// 在"开始表演"时执行，展示道具之间的物理互动
// ============================================================

import Phaser from 'phaser';
import type { PlacedProp } from '@/types';
import { PROP_MANIFEST } from '../assets/manifest';
import type { PropKey } from '../assets/manifest';

export interface EffectContext {
  scene: Phaser.Scene;
  /** 所有已放置道具的 Image 引用 (key: prop.id) */
  imageMap: Map<string, Phaser.GameObjects.Image>;
}

interface EffectResult {
  /** 效果描述文本 */
  description: string;
  /** 效果执行期间创建的特效对象（动画结束后自动清理） */
  cleanup: () => void;
}

/**
 * 单个道具的专属效果
 * 返回 EffectResult，包含描述和清理函数
 */
type PropEffectFn = (prop: PlacedProp, ctx: EffectContext) => EffectResult | null;

/**
 * 效果注册表：每个道具 key 对应一个效果函数
 */
const EFFECT_REGISTRY: Partial<Record<PropKey, PropEffectFn>> = {

  // 1. 香蕉皮 — 弹跳动画
  banana: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    let t = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.05;
        img.y = origY - Math.abs(Math.sin(t * 3)) * 8;
        img.angle = Math.sin(t * 4) * 10;
      },
    });
    return {
      description: '香蕉皮在地上弹跳摇晃',
      cleanup: () => { timer.destroy(); img.y = origY; img.angle = 0; },
    };
  },

  // 2. 传送门 — 旋转 + 缩放脉冲
  portal: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    let t = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.04;
        img.angle += 2;
        img.setScale(1 + Math.sin(t * 2) * 0.15);
        img.alpha = 0.6 + Math.sin(t * 3) * 0.4;
      },
    });
    return {
      description: '传送门旋转扭曲，发出紫色光晕',
      cleanup: () => { timer.destroy(); img.angle = 0; img.setScale(1); img.alpha = 1; },
    };
  },

  // 3. 弹射板 — 上下弹跳
  trampoline: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    let t = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.04;
        img.y = origY + Math.sin(t * 3) * 5;
        img.scaleY = 1 + Math.sin(t * 3) * 0.2;
      },
    });
    return {
      description: '弹射板上下压缩弹跳',
      cleanup: () => { timer.destroy(); img.y = origY; img.scaleY = 1; },
    };
  },

  // 4. 定时炸弹 — 抖动 + 红光闪烁
  bomb: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    let t = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.05;
        img.x += (Math.random() - 0.5) * 3;
        img.y += (Math.random() - 0.5) * 3;
        img.setTint(Phaser.Display.Color.GetColor(
          255,
          Math.floor(100 + Math.sin(t * 5) * 80),
          Math.floor(80 + Math.sin(t * 5) * 60),
        ));
      },
    });
    return {
      description: '炸弹剧烈抖动，红光急速闪烁',
      cleanup: () => { timer.destroy(); img.clearTint(); },
    };
  },

  // 5. 爆炸桶 — 膨胀 + 抖动
  barrel: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    let t = 0;
    const origScale = img.scaleX;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.04;
        const s = 1 + Math.abs(Math.sin(t * 2.5)) * 0.25;
        img.setScale(s);
        img.x += (Math.random() - 0.5) * 2;
        img.setTint(Phaser.Display.Color.GetColor(255, Math.floor(180 - Math.sin(t * 4) * 60), 0));
      },
    });
    return {
      description: '爆炸桶膨胀鼓动，随时要炸',
      cleanup: () => { timer.destroy(); img.setScale(origScale); img.clearTint(); },
    };
  },

  // 6. 呆萌 NPC — 左右摇晃 + 轻微弹跳
  clumsyNpc: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    let t = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.03;
        img.angle = Math.sin(t * 2) * 8;
        img.y = origY + Math.sin(t * 3) * 3;
      },
    });
    return {
      description: '呆萌NPC摇摇晃晃，站不稳',
      cleanup: () => { timer.destroy(); img.angle = 0; img.y = origY; },
    };
  },

  // 7. 咖啡杯 — 旋转 + 微小抖动
  coffeeCup: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    let t = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.03;
        img.angle = Math.sin(t * 3) * 5;
        img.x += (Math.random() - 0.5) * 0.8;
      },
    });
    return {
      description: '咖啡杯微微颤抖，热咖啡溅出',
      cleanup: () => { timer.destroy(); img.angle = 0; },
    };
  },

  // 8. 弹簧拳套 — 伸缩弹拳动画
  springGlove: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    let t = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.06;
        img.scaleX = 1 + Math.abs(Math.sin(t * 4)) * 0.4;
        img.x += Math.sin(t * 4) * 3;
      },
    });
    return {
      description: '弹簧拳套猛烈伸缩出拳',
      cleanup: () => { timer.destroy(); img.scaleX = 1; },
    };
  },

  // 9. 喷气背包 — 上升 + 火焰粒子效果
  jetpack: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    let t = 0;

    // 火焰粒子
    const particles: Phaser.GameObjects.Rectangle[] = [];
    const spawnFlame = () => {
      if (t > 2.8) return;
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
    };

    const flameTimer = ctx.scene.time.addEvent({ delay: 80, loop: true, callback: spawnFlame });

    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.04;
        img.y = origY - Math.min(t * 20, 40);
        img.angle = Math.sin(t * 5) * 3;

        // 粒子上升消散
        particles.forEach((p) => { p.y -= 2; p.alpha -= 0.03; if (p.alpha <= 0) p.destroy(); });
      },
    });

    return {
      description: '喷气背包点火升空，火焰喷射',
      cleanup: () => {
        timer.destroy();
        flameTimer.destroy();
        img.y = origY; img.angle = 0;
        particles.forEach((p) => p.destroy());
      },
    };
  },

  // 10. 磁铁地板 — 吸引周围道具
  magnet: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    let t = 0;
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

    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.03;
        img.angle = Math.sin(t * 3) * 5;
        img.setTint(Phaser.Display.Color.GetColor(180, 180, Math.floor(180 + Math.sin(t * 4) * 75)));

        // 吸引周围道具
        pullTargets.forEach((target) => {
          const dx = img.x - target.img.x;
          const dy = img.y - target.img.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = Math.min(2, 80 / dist);
          target.img.x += (dx / dist) * force;
          target.img.y += (dy / dist) * force;
        });
      },
    });

    return {
      description: '磁铁地板发出蓝光，吸引周围道具',
      cleanup: () => {
        timer.destroy();
        img.angle = 0; img.clearTint();
        pullTargets.forEach((t) => { t.img.x = t.origX; t.img.y = t.origY; });
      },
    };
  },

  // 11. 烟雾机 — 烟雾粒子扩散
  smokeMachine: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    let t = 0;
    const particles: Phaser.GameObjects.Arc[] = [];

    const spawnSmoke = () => {
      if (t > 2.8) return;
      const arc = ctx.scene.add.circle(
        img.x + (Math.random() - 0.5) * 20,
        img.y - 10 - Math.random() * 15,
        6 + Math.random() * 10,
        0xcccccc,
        0.5 + Math.random() * 0.3,
      ).setDepth(2);
      particles.push(arc);
    };

    const smokeTimer = ctx.scene.time.addEvent({ delay: 100, loop: true, callback: spawnSmoke });

    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.04;
        particles.forEach((p) => {
          p.y -= 0.6 + Math.random() * 0.4;
          p.x += (Math.random() - 0.5) * 1.5;
          p.alpha -= 0.008;
          p.setScale(p.scaleX + 0.02);
          if (p.alpha <= 0) p.destroy();
        });
      },
    });

    return {
      description: '烟雾机喷出滚滚浓烟，笼罩舞台',
      cleanup: () => { timer.destroy(); smokeTimer.destroy(); particles.forEach((p) => p.destroy()); },
    };
  },

  // 12. 镜子 — 翻转闪烁
  mirror: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    let t = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.05;
        img.alpha = 0.4 + Math.abs(Math.sin(t * 3)) * 0.6;
        img.setTint(Phaser.Display.Color.GetColor(
          Math.floor(200 + Math.sin(t * 4) * 55),
          Math.floor(200 + Math.cos(t * 4) * 55),
          255,
        ));
      },
    });
    return {
      description: '镜子闪烁反光，映出倒影',
      cleanup: () => { timer.destroy(); img.alpha = 1; img.clearTint(); },
    };
  },

  // 13. 自行车 — 向前移动 + 轮子旋转
  bicycle: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origX = img.x;
    let t = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.03;
        img.x = origX + Math.sin(t * 1.5) * 40;
        img.angle = Math.sin(t * 2) * 5;
        img.y += Math.sin(t * 3) * 1.5;
      },
    });
    return {
      description: '自行车来回骑行，轮子飞转',
      cleanup: () => { timer.destroy(); img.x = origX; img.angle = 0; },
    };
  },

  // 14. 胶水地毯 — 黏住效果（周围道具减速）
  glue: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    let t = 0;

    // 生成粘稠的视觉圈
    const ripples: Phaser.GameObjects.Arc[] = [];
    const spawnRipple = () => {
      if (t > 2.5) return;
      const arc = ctx.scene.add.circle(
        img.x + (Math.random() - 0.5) * 30,
        img.y + (Math.random() - 0.5) * 8,
        5,
        0xf39c12,
        0.3,
      ).setDepth(2);
      ripples.push(arc);
    };
    const rippleTimer = ctx.scene.time.addEvent({ delay: 300, loop: true, callback: spawnRipple });

    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.03;
        img.setTint(Phaser.Display.Color.GetColor(255, Math.floor(180 + Math.sin(t * 3) * 40), 30));
        ripples.forEach((r) => { r.alpha -= 0.01; r.setScale(r.scaleX + 0.03); if (r.alpha <= 0) r.destroy(); });
      },
    });

    return {
      description: '胶水地毯渗出黏稠液体，粘住路过道具',
      cleanup: () => { timer.destroy(); rippleTimer.destroy(); img.clearTint(); ripples.forEach((r) => r.destroy()); },
    };
  },

  // 15. 滑板 — 左右滑动
  skateboard: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origX = img.x;
    let t = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.04;
        img.x = origX + Math.sin(t * 2.5) * 50;
        img.angle = Math.sin(t * 2.5) * 8;
      },
    });
    return {
      description: '滑板快速左右滑行',
      cleanup: () => { timer.destroy(); img.x = origX; img.angle = 0; },
    };
  },

  // 16. 弹跳蘑菇 — 弹跳压缩
  bouncyMushroom: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    let t = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.05;
        const bounce = Math.abs(Math.sin(t * 3.5)) * 10;
        img.y = origY - bounce;
        img.scaleY = 1 - bounce * 0.02;
        img.scaleX = 1 + bounce * 0.02;
      },
    });
    return {
      description: '弹跳蘑菇一弹一弹，充满弹性',
      cleanup: () => { timer.destroy(); img.y = origY; img.scaleX = 1; img.scaleY = 1; },
    };
  },

  // 17. 吹风机 — 吹风粒子 + 推动前方道具
  hairDryer: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    let t = 0;

    // 风粒子
    const windParticles: Phaser.GameObjects.Rectangle[] = [];
    const spawnWind = () => {
      if (t > 2.8) return;
      const rect = ctx.scene.add.rectangle(
        img.x + 12 + Math.random() * 30,
        img.y + (Math.random() - 0.5) * 10,
        3 + Math.random() * 5,
        1 + Math.random() * 2,
        0xeeeeff,
        0.4 + Math.random() * 0.3,
      ).setDepth(2);
      windParticles.push(rect);
    };

    const windTimer = ctx.scene.time.addEvent({ delay: 50, loop: true, callback: spawnWind });

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

    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.04;
        img.angle = Math.sin(t * 8) * 2;
        windParticles.forEach((p) => {
          p.x += 3 + Math.random() * 2;
          p.alpha -= 0.015;
          if (p.alpha <= 0) p.destroy();
        });

        pushTargets.forEach((target) => {
          target.img.x += 1.5 + Math.random() * 0.5;
          target.img.y += (Math.random() - 0.5) * 1;
        });
      },
    });

    return {
      description: '吹风机呼呼吹风，把前方道具吹跑',
      cleanup: () => {
        timer.destroy(); windTimer.destroy();
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
    let t = 0;

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

    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.03;
        img.setTint(Phaser.Display.Color.GetColor(
          Math.floor(80 + Math.sin(t * 3) * 40),
          Math.floor(80 + Math.sin(t * 3) * 40),
          255,
        ));
        floatTargets.forEach((target) => {
          target.img.y -= 0.5 + Math.sin(t + parseFloat(target.img.name || '0')) * 0.3;
          target.img.x += Math.cos(t * 2) * 0.3;
          target.img.angle += 0.3;
        });
      },
    });

    return {
      description: '反向重力区启动，道具缓缓飘浮起来',
      cleanup: () => {
        timer.destroy(); img.clearTint();
        floatTargets.forEach((t) => { t.img.x = t.origX; t.img.y = t.origY; t.img.angle = 0; });
      },
    };
  },

  // 19. 假天花板 — 下压 + 震荡
  fakeCeiling: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    const origY = img.y;
    let t = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.04;
        img.y = origY + Math.sin(t * 1.5) * 15;
        img.alpha = 0.6 + Math.sin(t * 2) * 0.3;
        img.setTint(Phaser.Display.Color.GetColor(
          Math.floor(180 + Math.sin(t * 3) * 40),
          Math.floor(180 + Math.sin(t * 3) * 40),
          Math.floor(180 + Math.sin(t * 3) * 40),
        ));
      },
    });

    return {
      description: '假天花板缓缓下压，震得舞台发颤',
      cleanup: () => { timer.destroy(); img.y = origY; img.alpha = 1; img.clearTint(); },
    };
  },

  // 20. 旋转舞台 — 旋转
  rotatingStage: (prop, ctx) => {
    const img = ctx.imageMap.get(prop.id);
    if (!img) return null;
    let t = 0;
    const timer = ctx.scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.04;
        img.angle += 1.5;
        img.setTint(Phaser.Display.Color.GetColor(
          Math.floor(50 + Math.sin(t * 2) * 30),
          Math.floor(50 + Math.sin(t * 2) * 30),
          Math.floor(80 + Math.sin(t * 2) * 40),
        ));
      },
    });

    return {
      description: '旋转舞台缓缓转动，带动场景变换',
      cleanup: () => { timer.destroy(); img.angle = 0; img.clearTint(); },
    };
  },
};

/**
 * 对场景中所有已放置道具执行专属物理效果，持续 3 秒
 * 返回效果描述文本汇总
 */
export function executeAllEffects(
  placedProps: PlacedProp[],
  ctx: EffectContext,
  duration: number = 3000,
): string[] {
  const descriptions: string[] = [];
  const cleanups: (() => void)[] = [];

  for (const prop of placedProps) {
    const effectFn = EFFECT_REGISTRY[prop.type];
    if (!effectFn) continue;

    const result = effectFn(prop, ctx);
    if (result) {
      descriptions.push(`[${PROP_MANIFEST[prop.type].label}] ${result.description}`);
      cleanups.push(result.cleanup);
    }
  }

  // duration 毫秒后清理所有效果
  ctx.scene.time.delayedCall(duration, () => {
    cleanups.forEach((fn) => fn());
  });

  return descriptions;
}
