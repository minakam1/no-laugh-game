// ============================================================
// EditorScene — 道具拖拽 + 物理放置 + 触发器 + 撤回/清空
// ============================================================

import Phaser from 'phaser';
import { PROP_MANIFEST, PROP_MASS, PropKey } from '../assets/manifest';
import { eventBus } from '../bridges/PhaserEventBus';
import { toSnapshot, deriveEventChains } from '../systems/Serialization';
import { executeAllEffects, type EffectContext } from '../systems/PropEffectSystem';
import { buildObservationPacket } from '@/utils/buildMotionRelationGraph';
import { getSoundManager, PROP_EFFECT_SFX } from '@/audio/SoundManager';
import type { SfxEvent } from '@/audio/AudioManager';
import { useGameStore } from '@/store/gameStore';
import type { MotionObjectState, PlacedProp, SceneType } from '@/types';

let propIdCounter = 0;
const DEBUG_EDITOR_SCENE = import.meta.env.DEV;
const EFFECT_DURATION_MS = 5000;
const AFTER_SCREENSHOT_DELAY_MS = 6000;
const SCENE_BACKGROUND_KEYS: Record<SceneType, string> = {
  normal: 'scene-bg-normal',
  cliff: 'scene-bg-cliff',
  rapids: 'scene-bg-rapids',
  darkness: 'scene-bg-darkness',
  windstorm: 'scene-bg-windstorm',
};

function debugLog(...args: unknown[]): void {
  if (DEBUG_EDITOR_SCENE) console.log(...args);
}

function debugWarn(...args: unknown[]): void {
  if (DEBUG_EDITOR_SCENE) console.warn(...args);
}

function debugGroup(label: string): void {
  if (DEBUG_EDITOR_SCENE) console.group(label);
}

function debugGroupEnd(): void {
  if (DEBUG_EDITOR_SCENE) console.groupEnd();
}

type SplashParticle = Phaser.GameObjects.Rectangle & {
  vx: number;
  vy: number;
};

export class EditorScene extends Phaser.Scene {
  private placedProps: PlacedProp[] = [];
  private dragSprite: Phaser.GameObjects.Image | null = null;
  private performBtn!: Phaser.GameObjects.Image;
  private performBtnText!: Phaser.GameObjects.Text;
  private undoBtn!: Phaser.GameObjects.Image;
  private undoBtnText!: Phaser.GameObjects.Text;
  private clearBtn!: Phaser.GameObjects.Image;
  private clearBtnText!: Phaser.GameObjects.Text;
  private canvasBg!: Phaser.GameObjects.Image;
  private canvasBorder!: Phaser.GameObjects.Graphics;
  /** 画布区域边界（放置道具的有效区域，无顶部面板，全屏画布） */
  private readonly CANVAS_TOP = 10;
  private readonly CANVAS_BOTTOM = 910;
  private readonly CANVAS_LEFT = 10;
  private readonly CANVAS_RIGHT = 1270;
  /** 正在执行表演动画 */
  private isPerforming = false;
  /** 已放置道具 id -> Image 快速映射（O(1) 查找，替代 O(n*m) 遍历） */
  private propImageMap = new Map<string, Phaser.GameObjects.Image>();
  private propIdByImage = new Map<Phaser.GameObjects.Image, string>();
  /** 表演计时器文字 */
  private performTimerText: Phaser.GameObjects.Text | null = null;
  /** 表演开始时间戳 */
  private performStartTime = 0;
  // ============ 表演重力系统 ============
  /** 每个道具的垂直重力速度 (propId → vy) */
  private gravityVY = new Map<string, number>();
  /** 重力加速度（每帧） */
  private readonly GRAVITY = 0.3;
  /** 最大下落速度 */
  private readonly MAX_FALL_SPEED = 12;
  /** 地面反弹系数 */
  private readonly BOUNCE_FACTOR = 0.35;
  /** 速度低于此值时停止弹跳 */
  private readonly MIN_BOUNCE_VY = 0.5;
  // ============ 重力开关 ============
  private gravityEnabled = true;
  private gravityBtn!: Phaser.GameObjects.Image;
  private gravityBtnText!: Phaser.GameObjects.Text;
  // ============ 场景设定系统 ============
  private currentSceneType: SceneType = 'normal';
  /** 至暗时刻黑色遮罩 */
  private darknessOverlay!: Phaser.GameObjects.Rectangle;
  /** 悬崖边缘视觉标记 */
  private cliffMarker!: Phaser.GameObjects.Graphics;
  private cliffLabel!: Phaser.GameObjects.Text;
  /** 河流区域视觉 */
  private riverOverlay!: Phaser.GameObjects.Graphics;
  private windBoundary!: Phaser.GameObjects.Graphics;
  /** 暴风粒子 */
  private windParticles: Phaser.GameObjects.Rectangle[] = [];
  /** 道具被风吹的横向速度 */
  private windVX = new Map<string, number>();
  /** 道具在河流中被推动的速度 */
  private riverVX = new Map<string, number>();
  /** 悬崖掉落的绝对Y位置（抵抗道具tick位置重置） */
  private cliffFallY = new Map<string, number>();
  /** 水面溅射粒子 */
  private splashParticles: SplashParticle[] = [];
  /** 各场景环境音效定时器 */
  private sceneAmbientTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super({ key: 'EditorScene' });
  }

  create(): void {
    this.placedProps = [];
    this.propImageMap.clear();
    this.propIdByImage.clear();
    this.gravityVY.clear();
    this.cliffFallY.clear();
    propIdCounter = 0;

    debugLog('[EditorScene] create: 场景初始化');

    // 画布背景（默认为普通场景底图，居中于画布区域）
    const canvasCenterX = (this.CANVAS_LEFT + this.CANVAS_RIGHT) / 2;
    const canvasCenterY = (this.CANVAS_TOP + this.CANVAS_BOTTOM) / 2;
    this.canvasBg = this.add
      .image(canvasCenterX, canvasCenterY, SCENE_BACKGROUND_KEYS.normal)
      .setAlpha(0.92)
      .setDepth(0);

    // 画布边界框
    this.createCanvasBorder();

    // 表演按钮
    this.createPerformButton();

    // 撤回按钮
    this.createUndoButton();

    // 清空按钮
    this.createClearButton();

    // 重力开关
    this.createGravityToggle();

    // 放置区提示文字（画布中央）
    this.add
      .text(canvasCenterX, canvasCenterY, '从左侧面板拖拽道具到画布上', {
        fontFamily: 'Rajdhani, Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif',
        fontSize: '20px',
        color: '#6b6b8a',
      })
      .setOrigin(0.5)
      .setDepth(1);

    // === 已放置道具的拖拽事件 ===
    this.input.on(
      'dragstart',
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
        if (this.propIdByImage.has(gameObject)) {
          this.dragSprite = gameObject;
          this.dragSprite.setAlpha(0.7).setDepth(10);
        }
      },
    );

    this.input.on(
      'drag',
      (_pointer: Phaser.Input.Pointer, _gameObject: Phaser.GameObjects.Image, dragX: number, dragY: number) => {
        if (this.dragSprite) {
          this.dragSprite.setPosition(dragX, dragY);
        }
      },
    );

    this.input.on('dragend', () => {
      if (this.dragSprite) {
        this.dragSprite.setAlpha(1).setDepth(5);
        const propId = this.propIdByImage.get(this.dragSprite);
        const matchedProp = propId
          ? this.placedProps.find((p) => p.id === propId)
          : undefined;
        if (matchedProp) {
          matchedProp.x = Math.round(this.dragSprite.x);
          matchedProp.y = Math.round(this.dragSprite.y);
          matchedProp.positionDesc = this.describePosition(this.dragSprite.x, this.dragSprite.y);
        }
        this.dragSprite = null;
      }
    });

    // 监听 React 发来的放置道具请求（从左侧面板拖入）
    eventBus.on('request-place-prop', (data: unknown) => {
      const { key, x, y } = data as { key: PropKey; x: number; y: number };
      this.placeProp(key, x, y);
    });

    // 监听 React 发来的许愿机名字设置
    eventBus.on('wish-name-set', (data: unknown) => {
      const { propId, name } = data as { propId: string; name: string };
      const prop = this.placedProps.find((p) => p.id === propId);
      if (prop) {
        prop.wishName = name;
        debugLog(`[EditorScene] 许愿机 ${propId} 设置名字: ${name}`);
      }
    });

    // 监听 React 发来的清空画布请求
    eventBus.on('request-clear-scene', () => {
      this.handleClear();
    });

    // 监听 React 发来的背景切换请求
    eventBus.on('request-set-background', (data: unknown) => {
      const { key } = data as { key: string };
      this.setBackground(key);
    });

    // 监听 React 发来的场景设定切换请求
    eventBus.on('request-set-scene', (data: unknown) => {
      const { key } = data as { key: SceneType };
      this.setSceneType(key);
    });

    // 初始化场景视觉元素
    this.initSceneVisuals();

    // 清理可能的残留环境音效定时器
    this.stopSceneAmbient();

    // 通知 React 场景就绪
    eventBus.emit('scene-ready');
  }

  // ============================================================
  // 编辑模式：重力让道具自然下落；表演模式：仅计时器
  // ============================================================
  update(): void {
    if (this.isPerforming) {
      // 表演期间：更新计时器
      if (this.performTimerText) {
        const elapsed = this.time.now - this.performStartTime;
        const totalSec = Math.min(elapsed / 1000, EFFECT_DURATION_MS / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = Math.floor(totalSec % 60);
        const tenth = Math.floor((totalSec % 1) * 10);
        this.performTimerText.setText(`开播 ${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${tenth}`);
      }
      this.applySceneEffects(true);
      return;
    }

    // 编辑模式：全局重力 — 所有道具（含主角）向舞台底部自然下落 + 反弹
    // 悬崖/暴风场景由各自效果系统接管重力，跳过默认重力
    const skipDefaultGravity = !this.gravityEnabled || this.currentSceneType === 'cliff' || this.currentSceneType === 'windstorm';
    if (!skipDefaultGravity) {
      for (const [id, img] of this.propImageMap) {
        // 正在被拖拽的道具跳过重力
        if (img === this.dragSprite) continue;

        let vy = this.gravityVY.get(id) ?? 0;
        vy = Math.min(vy + this.GRAVITY, this.MAX_FALL_SPEED);
        const newY = img.y + vy;
        const groundY = this.getImageGroundY(img, this.CANVAS_BOTTOM) - 8;
        if (newY >= groundY) {
          img.y = groundY;
          vy = -vy * this.BOUNCE_FACTOR;
          if (Math.abs(vy) < this.MIN_BOUNCE_VY) vy = 0;
        } else {
          img.y = newY;
        }
        this.gravityVY.set(id, vy);
      }
    }

    // 场景设定效果（编辑模式）
    this.applySceneEffects(false);
  }

  private placeProp(key: PropKey, x: number, y: number): boolean {
    const manifest = PROP_MANIFEST[key];
    const cost = manifest.cost;

    // 检查头肯是否足够
    const { spendPoints } = useGameStore.getState();
    if (!spendPoints(cost)) {
      eventBus.emit('scene-error', { error: new Error(`头肯不足！${manifest.label}需要 ${cost} 头肯`) });
      return false;
    }

    const id = `prop-${++propIdCounter}`;

    debugLog(`[EditorScene] 放置道具: id=${id} type=${key} pos=(${Math.round(x)},${Math.round(y)}) cost=${cost}`);

    // 道具统一放大系数（基于 manifest 定义的 size 再放大 2.0 倍），主角单独放大
    const scale = key === 'clumsyNpc' ? 1.17 : 2.0;

    // 表演碰撞使用粗网格快照推导，这里保持为普通图片对象即可。
    // 主角锚点设到底部，图片已裁剪脚底贴边，originY=1 即可脚底对齐地面
    const originY = key === 'clumsyNpc' ? 0.998 : 0.5;
    const img = this.add
      .image(x, y, manifest.key)
      .setOrigin(0.5, originY)
      .setDisplaySize(manifest.size[0] * scale, manifest.size[1] * scale)
      .setInteractive({ draggable: true })
      .setDepth(5);

    // 注册到快速映射表
    this.propImageMap.set(id, img);
    this.propIdByImage.set(img, id);

    const placedProp: PlacedProp = {
      id,
      type: key,
      x: Math.round(x),
      y: Math.round(y),
      rotation: 0,
      positionDesc: this.describePosition(x, y),
      triggers: [],
    };

    this.placedProps.push(placedProp);

    // 如果是许愿机，触发名字输入请求
    if (key === 'wishMachine') {
      eventBus.emit('request-wish-name', { propId: id });
    }

    // 道具放置音效
    const sound = getSoundManager();
    sound.play('prop_drop');

    // 通知 React
    eventBus.emit('prop-placed', { prop: placedProp });
    return true;
  }

  /** 获取图片底部边缘的 Y 坐标（兼容不同 originY） */
  private getImageBottomY(img: Phaser.GameObjects.Image): number {
    return img.y + img.displayHeight * (1 - img.originY);
  }

  /** 计算图片锚点 Y 值，使其底部对齐到 floorY */
  private getImageGroundY(img: Phaser.GameObjects.Image, floorY: number): number {
    return floorY - img.displayHeight * (1 - img.originY);
  }

  private describePosition(x: number, y: number): string {
    const canvasW = this.CANVAS_RIGHT - this.CANVAS_LEFT;
    const canvasH = this.CANVAS_BOTTOM - this.CANVAS_TOP;
    const thirdX = this.CANVAS_LEFT + canvasW / 3;
    const twoThirdX = this.CANVAS_LEFT + (canvasW * 2) / 3;
    const thirdY = this.CANVAS_TOP + canvasH / 3;
    const twoThirdY = this.CANVAS_TOP + (canvasH * 2) / 3;
    const hPos = x < thirdX ? '左侧' : x > twoThirdX ? '右侧' : '中央';
    const vPos = y < thirdY ? '上方' : y > twoThirdY ? '下方' : '中间';
    return `${hPos}${vPos}`;
  }

  private createCanvasBorder(): void {
    this.canvasBorder = this.add.graphics().setDepth(3);

    const { CANVAS_LEFT: L, CANVAS_TOP: T, CANVAS_RIGHT: R, CANVAS_BOTTOM: B } = this;

    // 外框 - 霓虹青色
    this.canvasBorder.lineStyle(2, 0x00f0ff, 0.7);
    this.canvasBorder.strokeRect(L, T, R - L, B - T);

    // 内框 - 虚线效果（细线）
    this.canvasBorder.lineStyle(1, 0x00f0ff, 0.25);
    this.canvasBorder.strokeRect(L + 4, T + 4, R - L - 8, B - T - 8);

    // 四角加强标记
    const cornerSize = 16;
    this.canvasBorder.lineStyle(2, 0x00f0ff, 0.9);
    // 左上
    this.canvasBorder.moveTo(L, T + cornerSize);
    this.canvasBorder.lineTo(L, T);
    this.canvasBorder.lineTo(L + cornerSize, T);
    // 右上
    this.canvasBorder.moveTo(R - cornerSize, T);
    this.canvasBorder.lineTo(R, T);
    this.canvasBorder.lineTo(R, T + cornerSize);
    // 左下
    this.canvasBorder.moveTo(L, B - cornerSize);
    this.canvasBorder.lineTo(L, B);
    this.canvasBorder.lineTo(L + cornerSize, B);
    // 右下
    this.canvasBorder.moveTo(R - cornerSize, B);
    this.canvasBorder.lineTo(R, B);
    this.canvasBorder.lineTo(R, B - cornerSize);

    // 标签
    this.add
      .text(L + 8, T + 6, 'STAGE', {
        fontFamily: 'Orbitron, Rajdhani, Noto Sans SC, sans-serif',
        fontSize: '10px',
        color: '#00f0ff',
      })
      .setOrigin(0, 0)
      .setDepth(4)
      .setAlpha(0.6);
  }

  private createPerformButton(): void {
    const btnX = 1120;
    const btnY = 884;

    this.performBtn = this.add
      .image(btnX, btnY, 'btn-perform')
      .setInteractive({ useHandCursor: true })
      .setDepth(20);

    this.performBtnText = this.add
      .text(btnX, btnY, '◈ PERFORM', {
        fontFamily: 'Orbitron, Rajdhani, Noto Sans SC, sans-serif',
        fontSize: '18px',
        color: '#00f0ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.performBtn.on('pointerover', () => {
      this.performBtn.setScale(1.05);
      this.performBtnText.setScale(1.05);
      this.performBtnText.setText('◈ 开始');
    });
    this.performBtn.on('pointerout', () => {
      this.performBtn.setScale(1);
      this.performBtnText.setScale(1);
      this.performBtnText.setText('◈ PERFORM');
    });
    this.performBtn.on('pointerdown', () => {
      this.performBtn.setScale(0.95);
      this.performBtnText.setScale(0.95);
      this.handlePerform();
    });
  }

  private createUndoButton(): void {
    const btnX = 940;
    const btnY = 884;

    this.undoBtn = this.add
      .image(btnX, btnY, 'btn-undo')
      .setInteractive({ useHandCursor: true })
      .setDepth(20);

    this.undoBtnText = this.add
      .text(btnX, btnY, 'UNDO', {
        fontFamily: 'Orbitron, Rajdhani, Noto Sans SC, sans-serif',
        fontSize: '15px',
        color: '#ff00a0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.undoBtn.on('pointerover', () => {
      this.undoBtn.setScale(1.05);
      this.undoBtnText.setScale(1.05);
      this.undoBtnText.setText('撤销');
    });
    this.undoBtn.on('pointerout', () => {
      this.undoBtn.setScale(1);
      this.undoBtnText.setScale(1);
      this.undoBtnText.setText('UNDO');
    });
    this.undoBtn.on('pointerdown', () => {
      this.undoBtn.setScale(0.95);
      this.undoBtnText.setScale(0.95);
      this.handleUndo();
    });
  }

  private createClearButton(): void {
    const btnX = 800;
    const btnY = 884;

    this.clearBtn = this.add
      .image(btnX, btnY, 'btn-clear')
      .setInteractive({ useHandCursor: true })
      .setDepth(20);

    this.clearBtnText = this.add
      .text(btnX, btnY, 'CLEAR', {
        fontFamily: 'Orbitron, Rajdhani, Noto Sans SC, sans-serif',
        fontSize: '15px',
        color: '#a855f7',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.clearBtn.on('pointerover', () => {
      this.clearBtn.setScale(1.05);
      this.clearBtnText.setScale(1.05);
      this.clearBtnText.setText('清空');
    });
    this.clearBtn.on('pointerout', () => {
      this.clearBtn.setScale(1);
      this.clearBtnText.setScale(1);
      this.clearBtnText.setText('CLEAR');
    });
    this.clearBtn.on('pointerdown', () => {
      this.clearBtn.setScale(0.95);
      this.clearBtnText.setScale(0.95);
      this.handleClear();
    });
  }

  private createGravityToggle(): void {
    const btnX = 660;
    const btnY = 884;

    this.gravityBtn = this.add
      .image(btnX, btnY, 'btn-clear')
      .setInteractive({ useHandCursor: true })
      .setDepth(20);

    const updateLabel = () => {
      this.gravityBtnText.setText(this.gravityEnabled ? 'G:ON' : 'G:OFF');
      this.gravityBtnText.setColor(this.gravityEnabled ? '#00ff88' : '#ff4444');
    };

    this.gravityBtnText = this.add
      .text(btnX, btnY, '', {
        fontFamily: 'Orbitron, Rajdhani, Noto Sans SC, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(21);
    updateLabel();

    this.gravityBtn.on('pointerover', () => {
      this.gravityBtn.setScale(1.05);
      this.gravityBtnText.setScale(1.05);
    });
    this.gravityBtn.on('pointerout', () => {
      this.gravityBtn.setScale(1);
      this.gravityBtnText.setScale(1);
    });
    this.gravityBtn.on('pointerdown', () => {
      this.gravityBtn.setScale(0.95);
      this.gravityBtnText.setScale(0.95);
      this.gravityEnabled = !this.gravityEnabled;
      updateLabel();
    });
  }

  /** 由 React 侧触发切换背景 */
  private setBackground(key: string): void {
    this.canvasBg.setTexture(key);
    this.canvasBg.setAlpha(0.92);
    debugLog(`[EditorScene] 切换背景: ${key}`);

    // 背景切换音效
    const sound = getSoundManager();
    sound.play('prop_bg_switch');
  }

  // ============================================================
  // 场景设定系统
  // ============================================================

  /** 初始化场景视觉元素（悬崖标记、河流、黑暗遮罩、暴风粒子） */
  private initSceneVisuals(): void {
    // 至暗时刻：黑色全屏遮罩
    this.darknessOverlay = this.add
      .rectangle(
        (this.CANVAS_LEFT + this.CANVAS_RIGHT) / 2,
        (this.CANVAS_TOP + this.CANVAS_BOTTOM) / 2,
        this.CANVAS_RIGHT - this.CANVAS_LEFT,
        this.CANVAS_BOTTOM - this.CANVAS_TOP,
        0x000000, 1.0,
      )
      .setDepth(50)
      .setVisible(false);

    // 悬崖：高台 — 左侧抬高的平台（安全区，比地面高）→ 右边垂直坠落消失
    this.cliffMarker = this.add.graphics().setDepth(4).setVisible(false);

    // ===== 形状参数 =====
    // 平台：从左边延伸到约 72%，位置在画布偏上（高台！不是贴地）
    const platformEndX = this.CANVAS_LEFT + (this.CANVAS_RIGHT - this.CANVAS_LEFT) * 0.72;
    const platformY = this.CANVAS_TOP + (this.CANVAS_BOTTOM - this.CANVAS_TOP) * 0.62; // 高台在 62% 高度

    // ===== 绘制 =====

    // 1) 平台表面：蓝色粗实线（高台边缘线）
    this.cliffMarker.lineStyle(4, 0x44aaff, 0.95);
    this.cliffMarker.lineBetween(this.CANVAS_LEFT, platformY, platformEndX, platformY);

    // 2) 平台下方立体填充（给高台厚度感）
    this.cliffMarker.fillStyle(0x44aaff, 0.08);
    this.cliffMarker.fillRect(this.CANVAS_LEFT, platformY, platformEndX - this.CANVAS_LEFT, this.CANVAS_BOTTOM - platformY + 10);

    // 3) 断崖边缘：红色粗竖线（从平台边缘直落到底部）
    this.cliffMarker.lineStyle(4, 0xff3333, 0.95);
    this.cliffMarker.beginPath();
    this.cliffMarker.moveTo(platformEndX, platformY);
    this.cliffMarker.lineTo(platformEndX, this.CANVAS_BOTTOM + 30);
    this.cliffMarker.strokePath();
    this.cliffMarker.lineStyle(2, 0xffff66, 0.8);
    this.cliffMarker.strokeRect(platformEndX - 10, platformY - 10, 20, this.CANVAS_BOTTOM - platformY + 20);
    this.cliffMarker.fillStyle(0xff3333, 0.12);
    this.cliffMarker.fillRect(platformEndX, platformY, this.CANVAS_RIGHT - platformEndX, this.CANVAS_BOTTOM - platformY);

    // 4) ⚠ CLIFF 标记
    this.cliffLabel = this.add
      .text(platformEndX + 18, platformY - 24, '⚠ CLIFF', {
        fontFamily: 'Orbitron, Rajdhani, Noto Sans SC, monospace',
        fontSize: '11px',
        color: '#ff4444',
      })
      .setOrigin(0.5)
      .setDepth(5)
      .setVisible(false);

    // 河流区域：底部蓝色流动带（加宽到 160px）
    const riverHeight = 160;
    this.riverOverlay = this.add.graphics().setDepth(2).setVisible(false);
    // 底色（深蓝）
    this.riverOverlay.fillStyle(0x004488, 0.30);
    this.riverOverlay.fillRect(this.CANVAS_LEFT, this.CANVAS_BOTTOM - riverHeight, this.CANVAS_RIGHT - this.CANVAS_LEFT, riverHeight);
    // 水面渐层（中层变浅）
    this.riverOverlay.fillStyle(0x0066cc, 0.18);
    this.riverOverlay.fillRect(this.CANVAS_LEFT, this.CANVAS_BOTTOM - riverHeight, this.CANVAS_RIGHT - this.CANVAS_LEFT, riverHeight * 0.6);
    // 水波纹线（6条，适配更宽的河面）
    for (let i = 0; i < 6; i++) {
      const y = this.CANVAS_BOTTOM - riverHeight + 12 + i * 24;
      this.riverOverlay.lineStyle(1, 0x00aaff, 0.12 + i * 0.05);
      this.riverOverlay.beginPath();
      for (let x = this.CANVAS_LEFT; x <= this.CANVAS_RIGHT; x += 6) {
        if (x === this.CANVAS_LEFT) this.riverOverlay.moveTo(x, y + Math.sin(x * 0.03 + i) * 5);
        else this.riverOverlay.lineTo(x, y + Math.sin(x * 0.03 + i) * (3 + i * 0.8));
      }
      this.riverOverlay.strokePath();
    }
    this.drawRiverBoundary(riverHeight);

    this.windBoundary = this.add.graphics().setDepth(2).setVisible(false);
    this.drawWindBoundary();

    // 暴风粒子（初始隐藏，由 applySceneEffects 动态管理）
  }

  /** 切换场景类型 */
  private setSceneType(type: SceneType): void {
    this.currentSceneType = type;
    debugLog(`[EditorScene] 切换场景设定: ${type}`);

    // 更新各场景的可见性
    const isDarkness = type === 'darkness';
    const isCliff = type === 'cliff';
    const isRapids = type === 'rapids';
    const isWind = type === 'windstorm';

    this.canvasBg.setTexture(SCENE_BACKGROUND_KEYS[type]);
    this.canvasBg.setAlpha(0.92);
    this.darknessOverlay.setVisible(isDarkness);
    this.cliffMarker.setVisible(isCliff);
    this.cliffLabel.setVisible(isCliff);
    this.riverOverlay.setVisible(isRapids);
    this.windBoundary.setVisible(isWind);

    // 暴风：创建/销毁粒子
    if (!isWind) {
      this.windParticles.forEach((p) => p.destroy());
      this.windParticles = [];
      this.windVX.clear();
    }

    // 河流速度重置 + 水花清理
    if (!isRapids) {
      this.riverVX.clear();
      this.splashParticles.forEach((p) => p.destroy());
      this.splashParticles = [];
    }

    // 场景环境音效
    this.stopSceneAmbient();
    this.startSceneAmbient(type);
  }

  /** 启动场景环境音效 */
  private startSceneAmbient(type: SceneType): void {
    const sound = getSoundManager();
    const eventMap: Record<SceneType, SfxEvent | null> = {
      normal: null,
      cliff: 'ambient_cliff',
      rapids: 'ambient_rapids',
      darkness: 'ambient_darkness',
      windstorm: 'ambient_windstorm',
    };
    const event = eventMap[type];
    if (!event) return;

    // 立即播放一次
    sound.play(event);

    // 按间隔循环播放
    const intervals: Partial<Record<SceneType, number>> = {
      cliff: 1800,
      rapids: 2000,
      darkness: 2500,
      windstorm: 1500,
    };
    const interval = intervals[type] ?? 2000;
    this.sceneAmbientTimer = setInterval(() => {
      sound.play(event);
    }, interval);
  }

  /** 停止场景环境音效 */
  private stopSceneAmbient(): void {
    if (this.sceneAmbientTimer) {
      clearInterval(this.sceneAmbientTimer);
      this.sceneAmbientTimer = null;
    }
  }

  /** 每帧应用当前场景效果 */
  private applySceneEffects(performOnly: boolean): void {
    switch (this.currentSceneType) {
      case 'cliff':
        this.applyCliffEffect(performOnly);
        break;
      case 'rapids':
        this.applyRapidsEffect();
        break;
      case 'windstorm':
        this.applyWindStormEffect();
        break;
      // darkness 只影响视觉遮罩，在 perform 时移除
    }
  }

  // --- 悬崖效果：高台模式 — 左侧抬高平台（物理引擎限制道具不穿越蓝线），过崖边坠落消失 ---
  private applyCliffEffect(performOnly = false): void {
    const platformEndX = this.CANVAS_LEFT + (this.CANVAS_RIGHT - this.CANVAS_LEFT) * 0.72;
    const platformY = this.CANVAS_TOP + (this.CANVAS_BOTTOM - this.CANVAS_TOP) * 0.62;

    for (const [id, img] of this.propImageMap) {
      const leftEdge = img.x - Math.abs(img.displayWidth) * 0.45;
      const groundY = this.getImageGroundY(img, platformY) - 4;

      if (leftEdge < platformEndX) {
        // ===== 平台区域 =====

        // 强制兜底：道具无论如何不能低于平台表面（蓝线）
        if (img.y > groundY) {
          img.y = groundY;
          this.gravityVY.set(id, 0);
          // 同步更新数据模型中的位置
          const prop = this.placedProps.find((p) => p.id === id);
          if (prop) {
            prop.y = Math.round(groundY);
          }
        }

        if (performOnly) continue;
        // 编辑模式：跳过拖拽中的道具，正常重力落回平台
        if (img === this.dragSprite) continue;
        if (!this.gravityEnabled) continue;
        let vy = this.gravityVY.get(id) ?? 0;
        vy = Math.min(vy + this.GRAVITY, this.MAX_FALL_SPEED);
        const newY = img.y + vy;
        if (newY >= groundY) {
          img.y = groundY;
          vy = -vy * this.BOUNCE_FACTOR;
          if (Math.abs(vy) < this.MIN_BOUNCE_VY) vy = 0;
        } else {
          img.y = newY;
        }
        this.gravityVY.set(id, vy);
      } else {
        // ===== 过了崖边 → 强制掉落 =====
        if (!this.gravityEnabled) continue;
        let vy = this.gravityVY.get(id) ?? 0;
        let fallY = this.cliffFallY.get(id);
        if (fallY === undefined) {
          // 初次过线：记录当前实际 Y 作为下落起点
          fallY = img.y;
          vy = 8; // 过线瞬间立即获得大初速
          const sound = getSoundManager();
          sound.play('ambient_cliff_fall');
        }
        vy = Math.min(vy + 1.2, 16);
        fallY += vy;
        img.y = fallY;      // 绝对位置，不被道具 tick 覆盖
        img.angle += vy * 0.6;
        img.x += 0.5;
        this.gravityVY.set(id, vy);
        this.cliffFallY.set(id, fallY);

        if (fallY > this.CANVAS_BOTTOM + 40) {
          this.destroyPropById(id);
          this.gravityVY.delete(id);
          this.cliffFallY.delete(id);
        }
      }
    }
  }

  // --- 猛龙过江：底部宽阔河流推动 + 道具浮力晃荡（轻物随水快，重物沉底慢） ---
  private applyRapidsEffect(): void {
    if (!this.gravityEnabled) return; // 尊重重力开关
    const riverHeight = 160;               // 河面高度（与视觉一致）
    const riverTop = this.CANVAS_BOTTOM - riverHeight;
    const riverSpeed = 2.5;                // 每帧水流推动速度

    for (const [id, img] of this.propImageMap) {
      if (img === this.dragSprite) continue;

      // 质量影响：轻物浮起随水走，重物沉底不动
      const prop = this.placedProps.find(p => p.id === id);
      const mass = prop ? (PROP_MASS[prop.type] ?? 3) : 3;
      if (!isFinite(mass)) continue;
      const massFactor = 1 / mass; // 轻物大，重物小

      // 道具底部是否在河流区域内
      const inWater = this.getImageBottomY(img) - img.displayHeight * 0.2 > riverTop;

      if (inWater) {
        // === 水流横向推动（轻物快，重物慢） ===
        let vx = this.riverVX.get(id) ?? 0;
        const effectiveSpeed = riverSpeed * massFactor;
        vx = Math.min(vx + 0.15 * massFactor, effectiveSpeed);
        img.x += vx;
        this.riverVX.set(id, vx);

        // === 浮力上下晃动（轻物浮得高，重物沉底） ===
        const bobAmp = (3 + img.displayHeight * 0.02) * massFactor;
        const bobFreq = 0.006;
        img.y += Math.sin(this.time.now * bobFreq + id.charCodeAt(1)) * bobAmp;

        // === 摇摆晃动 ===
        img.angle += Math.sin(this.time.now * 0.008 + id.charCodeAt(2)) * 0.25 * massFactor;
        img.angle *= 0.97;

        // === 水面溅射粒子 ===
        if (Math.random() < 0.15) {
          this.spawnSplashAt(img.x, this.getImageBottomY(img) - img.displayHeight * 0.15);
        }

        // 掉出右边界消失
        if (img.x > this.CANVAS_RIGHT + 60) {
          this.destroyPropById(id);
          this.riverVX.delete(id);
        }
      } else {
        this.riverVX.delete(id);
      }
    }

    // 更新河流动画 + 水花粒子
    this.animateRiverOverlay();
    this.updateSplashParticles();
  }

  // --- 暴风：道具被吹离地面，悬浮在空中飘荡（轻物飞远，重物微移） ---
  private applyWindStormEffect(): void {
    if (!this.gravityEnabled) return; // 尊重重力开关
    const windBaseForce = 1.0;   // 基础风力
    const gustChance = 0.02;      // 阵风概率

    for (const [id, img] of this.propImageMap) {
      if (img === this.dragSprite) continue;

      // 质量影响：轻物被吹得更远，重物几乎不动
      const prop = this.placedProps.find(p => p.id === id);
      const mass = prop ? (PROP_MASS[prop.type] ?? 3) : 3;
      // 无限质量=固定物体，不受暴风影响
      if (!isFinite(mass)) continue;
      const massFactor = 1 / mass; // 轻物massFactor大，重物小

      const groundY = this.getImageGroundY(img, this.CANVAS_BOTTOM) - 8;

      // 每个道具的目标悬浮高度（轻物更高，重物几乎不离地）
      const hash = id.charCodeAt(0) + id.charCodeAt(1) * 31 + id.charCodeAt(3) * 17;
      const baseOffset = 60 + (Math.abs(hash) % 160);
      const targetFloatOffset = baseOffset * massFactor; // 轻物悬浮更高
      const targetFloatY = groundY - targetFloatOffset;

      let vx = this.windVX.get(id) ?? 0;

      // 基础持续斜向风力（轻物加速快，重物加速慢）
      vx = Math.min(vx + windBaseForce * 0.05 * massFactor, windBaseForce * massFactor * 2);

      // 随机阵风
      if (Math.random() < gustChance) {
        vx += (Math.random() * 3 + 1) * massFactor;
      }

      // === 横向移动 ===
      img.x += vx * 0.7;

      // === 纵向升力 ===
      const liftForce = 0.5 * massFactor; // 轻物升力大，重物升力小
      if (img.y > targetFloatY + 10) {
        img.y -= liftForce + Math.abs(vx) * 0.5;
        this.gravityVY.set(id, Math.max(0, (this.gravityVY.get(id) ?? 0) - 0.4));
      } else if (img.y < targetFloatY - 10) {
        img.y += liftForce * 0.3;
      } else {
        img.y += Math.sin(this.time.now * 0.004 + hash) * 0.7 * massFactor;
        this.gravityVY.set(id, 0);
      }

      // 斜向气流
      img.y += vx * -0.3;
      img.y += Math.sin(this.time.now * 0.005 + hash) * 0.3 * massFactor;

      // === 旋转 ===
      img.angle += vx * 0.03;
      img.angle += Math.sin(this.time.now * 0.002 + hash) * 0.15;

      this.windVX.set(id, vx);

      // 吹出边界消失
      if (
        img.x > this.CANVAS_RIGHT + 100 ||
        img.y < this.CANVAS_TOP - 80 ||
        img.x < this.CANVAS_LEFT - 60
      ) {
        this.destroyPropById(id);
        this.windVX.delete(id);
      }
    }

    // 更新风粒子动画（斜向上）
    this.updateWindParticles();
  }

  /** 河流水波纹动画 */
  private animateRiverOverlay(): void {
    if (!this.riverOverlay.visible) return;
    this.riverOverlay.clear();

    const riverHeight = 160;
    const offset = (this.time.now * 0.002) % 16;

    // 底色 + 渐层
    this.riverOverlay.fillStyle(0x004488, 0.30);
    this.riverOverlay.fillRect(this.CANVAS_LEFT, this.CANVAS_BOTTOM - riverHeight, this.CANVAS_RIGHT - this.CANVAS_LEFT, riverHeight);
    this.riverOverlay.fillStyle(0x0066cc, 0.18);
    this.riverOverlay.fillRect(this.CANVAS_LEFT, this.CANVAS_BOTTOM - riverHeight, this.CANVAS_RIGHT - this.CANVAS_LEFT, riverHeight * 0.6);

    // 水波纹线（6条，覆盖更深的水面）
    for (let i = 0; i < 6; i++) {
      const baseY = this.CANVAS_BOTTOM - riverHeight + 12 + i * 24;
      this.riverOverlay.lineStyle(1, 0x00aaff, 0.12 + i * 0.05);
      this.riverOverlay.beginPath();
      for (let x = this.CANVAS_LEFT - offset; x <= this.CANVAS_RIGHT; x += 6) {
        const y = baseY + Math.sin((x + offset) * 0.04 + i) * (3 + i * 0.8);
        if (x <= this.CANVAS_LEFT - offset + 6) this.riverOverlay.moveTo(Math.max(this.CANVAS_LEFT, x), y);
        else this.riverOverlay.lineTo(Math.max(this.CANVAS_LEFT, x), y);
      }
      this.riverOverlay.strokePath();
    }

    // 流动箭头指示（更大，适配宽河面）
    this.riverOverlay.fillStyle(0xffffff, 0.15);
    const arrowY = this.CANVAS_BOTTOM - 50;
    for (let ax = this.CANVAS_LEFT + 30 + ((this.time.now * 0.08) % 120); ax < this.CANVAS_RIGHT - 20; ax += 120) {
      this.riverOverlay.fillTriangle(ax - 8, arrowY - 4, ax - 8, arrowY + 4, ax + 4, arrowY);
    }

    this.drawRiverBoundary(riverHeight);
  }

  private drawRiverBoundary(riverHeight: number): void {
    const riverTop = this.CANVAS_BOTTOM - riverHeight;

    this.riverOverlay.lineStyle(5, 0xe7ff2f, 0.9);
    this.riverOverlay.lineBetween(this.CANVAS_LEFT, riverTop, this.CANVAS_RIGHT, riverTop);
    this.riverOverlay.lineStyle(2, 0x00f0ff, 0.85);
    this.riverOverlay.lineBetween(this.CANVAS_LEFT, riverTop + 8, this.CANVAS_RIGHT, riverTop + 8);
    this.riverOverlay.fillStyle(0x00f0ff, 0.09);
    this.riverOverlay.fillRect(this.CANVAS_LEFT, riverTop, this.CANVAS_RIGHT - this.CANVAS_LEFT, 18);

    const markerY = riverTop - 18;
    this.riverOverlay.fillStyle(0xe7ff2f, 0.75);
    for (let x = this.CANVAS_LEFT + 24; x < this.CANVAS_RIGHT - 24; x += 84) {
      this.riverOverlay.fillTriangle(x - 8, markerY, x + 8, markerY, x, markerY + 12);
    }
  }

  private drawWindBoundary(): void {
    const zoneTop = this.CANVAS_TOP + 110;
    const zoneBottom = this.CANVAS_BOTTOM - 90;

    this.windBoundary.clear();
    this.windBoundary.fillStyle(0x8ecbff, 0.06);
    this.windBoundary.fillRect(this.CANVAS_LEFT, zoneTop, this.CANVAS_RIGHT - this.CANVAS_LEFT, zoneBottom - zoneTop);
    this.windBoundary.lineStyle(4, 0xe7ff2f, 0.82);
    this.windBoundary.lineBetween(this.CANVAS_LEFT, zoneBottom, this.CANVAS_RIGHT, zoneBottom);
    this.windBoundary.lineStyle(2, 0x8ecbff, 0.64);
    this.windBoundary.lineBetween(this.CANVAS_LEFT, zoneTop, this.CANVAS_RIGHT, zoneTop);

    this.windBoundary.fillStyle(0xe7ff2f, 0.68);
    for (let x = this.CANVAS_LEFT + 40; x < this.CANVAS_RIGHT - 20; x += 110) {
      this.windBoundary.fillTriangle(x, zoneBottom - 18, x + 18, zoneBottom - 9, x, zoneBottom);
    }
  }

  /** 生成水面溅射粒子（道具接触水面时） */
  private spawnSplashAt(x: number, y: number): void {
    if (this.splashParticles.length > 30) return;
    // 随机方向的小水花颗粒
    for (let i = 0; i < 3; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI; // 向上扇形
      const speed = 1 + Math.random() * 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const particle = this.add
        .rectangle(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3, 0x88ccff, 0.7)
        .setDepth(7) as SplashParticle;
      particle.vx = vx;
      particle.vy = vy;
      this.splashParticles.push(particle);
    }
  }

  /** 更新水面溅射粒子（上升→下落→消失） */
  private updateSplashParticles(): void {
    const gravity = 0.08;
    for (let i = this.splashParticles.length - 1; i >= 0; i--) {
      const p = this.splashParticles[i];
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.015;
      p.scaleX *= 0.995;
      p.scaleY *= 0.995;

      if (p.alpha <= 0 || p.y > this.CANVAS_BOTTOM + 20) {
        p.destroy();
        this.splashParticles.splice(i, 1);
      }
    }
  }

  /** 更新暴风可视化粒子（斜向上） */
  private updateWindParticles(): void {
    const upAngle = -0.55; // 与 applyWindStormEffect 一致的斜向角度

    // 定期生成新粒子（从左下方向右上方吹）
    if (Math.random() < 0.08 && this.windParticles.length < 25) {
      const px = this.CANVAS_LEFT - 20;
      // 粒子起始位置偏下方，模拟斜向气流
      const py = this.CANVAS_BOTTOM - Math.random() * (this.CANVAS_BOTTOM - this.CANVAS_TOP) * 0.6;
      const particle = this.add
        .rectangle(px, py, 12 + Math.random() * 18, 1, 0xaaccff, 0.4 + Math.random() * 0.3)
        .setDepth(6);
      this.windParticles.push(particle);
    }

    // 移动并清理粒子（斜向右上）
    for (let i = this.windParticles.length - 1; i >= 0; i--) {
      const p = this.windParticles[i];
      p.x += 4 + Math.random() * 4;
      p.y += (4 + Math.random() * 4) * upAngle + (Math.random() - 0.5) * 0.8;
      p.alpha -= 0.003;

      if (p.x > this.CANVAS_RIGHT + 20 || p.y < this.CANVAS_TOP - 30 || p.alpha <= 0) {
        p.destroy();
        this.windParticles.splice(i, 1);
      }
    }
  }

  /** 根据道具ID销毁道具（悬崖掉落/河流冲走/暴风吹走） */
  private destroyPropById(propId: string): void {
    const img = this.propImageMap.get(propId);
    if (!img) return;

    // 从 placedProps 中移除
    const idx = this.placedProps.findIndex((p) => p.id === propId);
    if (idx >= 0) {
      const prop = this.placedProps[idx];
      // 退还头肯
      const manifest = PROP_MANIFEST[prop.type];
      if (manifest) {
        const { refundPoints } = useGameStore.getState();
        refundPoints(manifest.cost);
      }
      this.placedProps.splice(idx, 1);
    }

    // 销毁图像对象
    img.destroy();
    this.propImageMap.delete(propId);
    this.propIdByImage.delete(img);
    this.gravityVY.delete(propId);
    this.cliffFallY.delete(propId);
    this.windVX.delete(propId);
    this.riverVX.delete(propId);

    eventBus.emit('prop-removed', { propId });
  }

  private handleUndo(): void {
    if (this.placedProps.length === 0) return;

    // 移除最后一个放置的道具
    const lastProp = this.placedProps.pop();
    if (!lastProp) return;

    // 退还头肯
    const manifest = PROP_MANIFEST[lastProp.type];
    if (manifest) {
      const { refundPoints } = useGameStore.getState();
      refundPoints(manifest.cost);
    }

    // O(1) 从映射表找到对应的图像对象并销毁
    const img = this.propImageMap.get(lastProp.id);
    if (img) {
      img.destroy();
      this.propImageMap.delete(lastProp.id);
      this.propIdByImage.delete(img);
    }

    // 撤销音效
    const sound = getSoundManager();
    sound.play('prop_undo');

    // 通知 React
    eventBus.emit('prop-removed', { propId: lastProp.id });
  }

  private handleClear(): void {
    if (this.placedProps.length === 0) return;

    // 计算所有被清除道具的总头肯成本并退还
    let totalRefund = 0;
    for (const prop of this.placedProps) {
      const manifest = PROP_MANIFEST[prop.type];
      if (manifest) {
        totalRefund += manifest.cost;
      }
    }
    if (totalRefund > 0) {
      const { refundPoints } = useGameStore.getState();
      refundPoints(totalRefund);
      debugLog(`[EditorScene] handleClear: 退还 ${totalRefund} 头肯`);
    }

    debugLog(`[EditorScene] handleClear: 清除 ${this.placedProps.length} 个道具`);

    // O(n) 通过映射表销毁所有已放置道具
    for (const img of this.propImageMap.values()) {
      img.destroy();
    }
    this.propImageMap.clear();
    this.propIdByImage.clear();
    this.gravityVY.clear();
    this.cliffFallY.clear();
    this.placedProps = [];

    debugLog(`[EditorScene] handleClear: 完成, propImageMap=${this.propImageMap.size}, placedProps=${this.placedProps.length}`);

    // 清空音效
    const sound = getSoundManager();
    sound.play('prop_clear');

    // 通知 React
    eventBus.emit('scene-cleared');
  }

  private async handlePerform(): Promise<void> {
    const perfId = `perf-${Date.now() % 100000}`;
    debugGroup(`[EditorScene:${perfId}] === 开始表演 ===`);

    if (this.placedProps.length === 0) {
      debugWarn(`[EditorScene:${perfId}] 没有道具，跳过`);
      debugGroupEnd();
      eventBus.emit('scene-error', { error: new Error('请至少放置一个道具') });
      return;
    }

    if (this.isPerforming) {
      debugWarn(`[EditorScene:${perfId}] 正在表演中，跳过重复调用`);
      debugGroupEnd();
      return;
    }
    this.isPerforming = true;

    // 左下角表演计时器
    this.performStartTime = this.time.now;
    this.performTimerText?.destroy();
    this.performTimerText = this.add
      .text(this.CANVAS_LEFT + 12, this.CANVAS_BOTTOM - 18, '开播 00:00.0', {
        fontFamily: 'Orbitron, Rajdhani, Noto Sans SC, monospace',
        fontSize: '18px',
        color: '#00ff88',
      })
      .setOrigin(0, 0.5)
      .setDepth(100)
      .setAlpha(0.9);

    debugLog(`[EditorScene:${perfId}] 道具数量: ${this.placedProps.length}, propImageMap大小: ${this.propImageMap.size}`);

    // 禁用按钮
    this.performBtn.disableInteractive();
    this.performBtn.setAlpha(0.4);
    this.performBtnText.setAlpha(0.4);
    this.undoBtn.disableInteractive();
    this.undoBtn.setAlpha(0.4);
    this.undoBtnText.setAlpha(0.4);
    this.clearBtn.disableInteractive();
    this.clearBtn.setAlpha(0.4);
    this.clearBtnText.setAlpha(0.4);

    // 至暗时刻：表演开始时移除黑暗遮罩，露出舞台
    if (this.currentSceneType === 'darkness') {
      this.darknessOverlay.setVisible(false);
    }

    // 保存道具原始位置（用于动画结束后恢复）
    const propOrigins = new Map<string, { x: number; y: number; angle: number; alpha: number; scaleX: number; scaleY: number }>();
    for (const [id, img] of this.propImageMap) {
      propOrigins.set(id, {
        x: img.x, y: img.y, angle: img.angle,
        alpha: img.alpha, scaleX: img.scaleX, scaleY: img.scaleY,
      });
      debugLog(`[EditorScene:${perfId}] 道具 ${id}: pos=(${img.x.toFixed(0)},${img.y.toFixed(0)}) active=${img.active} visible=${img.visible}`);
    }

    try {
      const connections = deriveEventChains(this.placedProps);
      debugLog(`[EditorScene:${perfId}] 碰撞链数量: ${connections.length}`);
      const snapshot = toSnapshot(this.placedProps, connections);
      const beforeStates = this.captureObjectStates();

      // === 第1步：截取动画前的画面 ===
      debugLog(`[EditorScene:${perfId}] 步骤1: 截取表演前截图`);
      const beforeScreenshot = this.captureScreenshot();
      debugLog(`[EditorScene:${perfId}] 截图前: ${beforeScreenshot.length} 字符`);

      // === 第2步：播放3秒物理动画 ===
      debugLog(`[EditorScene:${perfId}] 步骤2: 开始效果动画`);
      const imageMap = this.buildImageMap();
      const propTypeMap = new Map<string, PropKey>();
      for (const prop of this.placedProps) {
        propTypeMap.set(prop.id, prop.type);
      }
      const effectCtx: EffectContext = {
        scene: this,
        imageMap,
        propTypeMap,
        canvasBottom: this.CANVAS_BOTTOM,
        canvasLeft: this.CANVAS_LEFT,
        canvasRight: this.CANVAS_RIGHT,
        // 悬崖模式：物理引擎以平台蓝线为地面，道具不可穿过
        cliffPlatformY:
          this.currentSceneType === 'cliff'
            ? this.CANVAS_TOP + (this.CANVAS_BOTTOM - this.CANVAS_TOP) * 0.62
            : undefined,
      };

      // 表演开始音效
      const sound = getSoundManager();
      sound.play('perform_start');

      // 启动所有道具的持续动画音效
      for (const prop of this.placedProps) {
        const sfxConfig = PROP_EFFECT_SFX[prop.type];
        if (sfxConfig) {
          if (sfxConfig.interval > 0) {
            // 循环播放的持续音效
            sound.startContinuousEffect(prop.id, sfxConfig.event, sfxConfig.interval);
          } else {
            // 一次性播放（像 portal/bomb 等由 AudioManager 内部合成完整持续音频）
            sound.play(sfxConfig.event);
          }
        }
      }

      const effectDescriptions = executeAllEffects(this.placedProps, effectCtx, EFFECT_DURATION_MS);
      debugLog(`[EditorScene:${perfId}] 效果数量: ${effectDescriptions.length}`);
      for (const desc of effectDescriptions) {
        debugLog(`[EditorScene:${perfId}]   效果: ${desc}`);
      }

      // 在效果清理前截图，确保动画后的画面仍保留可见变化。
      debugLog(`[EditorScene:${perfId}] 等待${AFTER_SCREENSHOT_DELAY_MS}ms...`);
      await new Promise<void>((resolve) => {
        let resolved = false;
        const safeResolve = () => {
          if (!resolved) {
            resolved = true;
            debugLog(`[EditorScene:${perfId}] Promise resolved`);
            resolve();
          }
        };
        // 安全兜底：AFTER_SCREENSHOT_DELAY_MS + 2s 后强制 resolve，防止 timer 丢失导致永久等待
        const safety = this.time.delayedCall(AFTER_SCREENSHOT_DELAY_MS + 2000, () => {
          debugWarn(`[EditorScene:${perfId}] 安全兜底触发! done.hasDispatched=${done.hasDispatched}`);
          safeResolve();
        });
        // 正常触发：到时间后先销毁安全兜底再 resolve
        const done = this.time.delayedCall(AFTER_SCREENSHOT_DELAY_MS, () => {
          safety.destroy();
          safeResolve();
        });
      });
      debugLog(`[EditorScene:${perfId}] 等待完成，检查道具状态...`);
      for (const [id, img] of this.propImageMap) {
        debugLog(`[EditorScene:${perfId}]   道具 ${id}: pos=(${img.x.toFixed(0)},${img.y.toFixed(0)}) active=${img.active} visible=${img.visible} alpha=${img.alpha.toFixed(2)}`);
      }

      // === 第3步：截取动画后的画面 ===
      debugLog(`[EditorScene:${perfId}] 步骤3: 截取表演后截图`);
      const afterScreenshot = this.captureScreenshot();
      const afterStates = this.captureObjectStates();
      debugLog(`[EditorScene:${perfId}] 截图后: ${afterScreenshot.length} 字符`);

      // === 第4步：发送给 AI（截图 + 运动关系事实）===
      const observation = buildObservationPacket({
        props: this.placedProps,
        chains: connections,
        before: beforeStates,
        after: afterStates,
        effects: effectDescriptions,
        durationMs: AFTER_SCREENSHOT_DELAY_MS,
        sceneType: this.currentSceneType,
      });
      debugLog(`[EditorScene:${perfId}] 步骤4: 发送perform-requested事件`);
      eventBus.emit('perform-requested', {
        snapshot,
        observation,
        beforeScreenshot,
        afterScreenshot,
        effectDescriptions,
      });
      debugLog(`[EditorScene:${perfId}] === 表演成功完成 ===`);
    } catch (err) {
      console.error(`[EditorScene:${perfId}] 表演异常:`, err);
      eventBus.emit('scene-error', { error: err instanceof Error ? err : new Error('表演执行失败') });
    } finally {
      debugLog(`[EditorScene:${perfId}] finally: 清理和恢复...`);

      // 清除重力/悬崖状态，下次表演重头开始
      this.gravityVY.clear();
      this.cliffFallY.clear();

      // 停止所有道具持续音效
      const sound = getSoundManager();
      sound.stopAllContinuousEffects();
      sound.play('perform_end');

      // 确保所有道具恢复到原始状态（兜底恢复）
      let restoredCount = 0;
      for (const [id, img] of this.propImageMap) {
        const orig = propOrigins.get(id);
        if (orig && img.active) {
          img.x = orig.x;
          img.y = orig.y;
          img.angle = orig.angle;
          img.alpha = orig.alpha;
          img.setScale(orig.scaleX, orig.scaleY);
          img.clearTint();
          restoredCount++;
        }
      }
      debugLog(`[EditorScene:${perfId}] finally: 恢复了 ${restoredCount}/${this.propImageMap.size} 个道具`);

      // 清理计时器
      this.performTimerText?.destroy();
      this.performTimerText = null;

      // 恢复按钮
      this.isPerforming = false;
      this.performBtn.setInteractive({ useHandCursor: true });
      this.performBtn.setAlpha(1);
      this.performBtnText.setAlpha(1);
      this.undoBtn.setInteractive({ useHandCursor: true });
      this.undoBtn.setAlpha(1);
      this.undoBtnText.setAlpha(1);
      this.clearBtn.setInteractive({ useHandCursor: true });
      this.clearBtn.setAlpha(1);
      this.clearBtnText.setAlpha(1);

      // 至暗时刻：表演结束后重新遮罩
      if (this.currentSceneType === 'darkness') {
        this.darknessOverlay.setVisible(true);
      }
      debugLog(`[EditorScene:${perfId}] === 表演清理完成 ===`);
      debugGroupEnd();
    }
  }

  /** 截取 Phaser Canvas 画布为 base64 图片 */
  private captureScreenshot(): string {
    const canvas = this.sys.game.canvas as HTMLCanvasElement;
    try {
      // 尝试 JPEG 格式（体积小），失败则回退 PNG
      const jpeg = canvas.toDataURL('image/jpeg', 0.7);
      // 验证是否为有效 JPEG（Phaser CANVAS 模式下某些浏览器可能不支持）
      if (jpeg && jpeg.startsWith('data:image/jpeg')) {
        return jpeg;
      }
      return canvas.toDataURL('image/png');
    } catch {
      return canvas.toDataURL('image/png');
    }
  }

  private captureObjectStates(): Record<string, MotionObjectState> {
    const states: Record<string, MotionObjectState> = {};
    for (const [id, img] of this.propImageMap) {
      states[id] = {
        x: Math.round(img.x),
        y: Math.round(img.y),
        angle: Math.round(img.angle * 10) / 10,
        scaleX: Math.round(img.scaleX * 100) / 100,
        scaleY: Math.round(img.scaleY * 100) / 100,
        alpha: Math.round(img.alpha * 100) / 100,
      };
    }
    return states;
  }

  /** 获取已放置道具的 Image 映射表（O(1)，直接返回预构建的 map） */
  private buildImageMap(): Map<string, Phaser.GameObjects.Image> {
    return this.propImageMap;
  }

  /** 外部调用：清空场景 */
  clearScene(): void {
    this.placedProps = [];
    propIdCounter = 0;
    for (const img of this.propImageMap.values()) {
      img.destroy();
    }
    this.propImageMap.clear();
    this.propIdByImage.clear();
    this.gravityVY.clear();
    this.cliffFallY.clear();
  }
}
