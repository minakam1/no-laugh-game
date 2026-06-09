// ============================================================
// EditorScene — 道具拖拽 + 物理放置 + 触发器 + 撤回/清空
// ============================================================

import Phaser from 'phaser';
import { PROP_MANIFEST, PROP_LIST, PropKey } from '../assets/manifest';
import { eventBus } from '../bridges/PhaserEventBus';
import { toSnapshot, deriveEventChains } from '../systems/Serialization';
import { executeAllEffects, type EffectContext } from '../systems/PropEffectSystem';
import { buildObservationPacket } from '@/utils/buildMotionRelationGraph';
import type { MotionObjectState, PlacedProp } from '@/types';

let propIdCounter = 0;
const DEBUG_EDITOR_SCENE = import.meta.env.DEV;
const EFFECT_DURATION_MS = 3200;
const AFTER_SCREENSHOT_DELAY_MS = 3000;

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

export class EditorScene extends Phaser.Scene {
  private placedProps: PlacedProp[] = [];
  private dragSprite: Phaser.GameObjects.Image | null = null;
  private performBtn!: Phaser.GameObjects.Image;
  private performBtnText!: Phaser.GameObjects.Text;
  private undoBtn!: Phaser.GameObjects.Image;
  private undoBtnText!: Phaser.GameObjects.Text;
  private clearBtn!: Phaser.GameObjects.Image;
  private clearBtnText!: Phaser.GameObjects.Text;
  private bgBtn!: Phaser.GameObjects.Image;
  private bgBtnText!: Phaser.GameObjects.Text;
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
  /** 当前背景索引 */
  private currentBg = 0;
  private bgTextures = ['grid-bg', 'bg-dark', 'bg-studio', 'bg-neon'];

  constructor() {
    super({ key: 'EditorScene' });
  }

  create(): void {
    this.placedProps = [];
    this.propImageMap.clear();
    this.propIdByImage.clear();
    propIdCounter = 0;

    debugLog('[EditorScene] create: 场景初始化');

    // 画布背景（默认为网格，居中于画布区域）
    const canvasCenterX = (this.CANVAS_LEFT + this.CANVAS_RIGHT) / 2;
    const canvasCenterY = (this.CANVAS_TOP + this.CANVAS_BOTTOM) / 2;
    this.canvasBg = this.add.image(canvasCenterX, canvasCenterY, this.bgTextures[0]).setAlpha(0.3).setDepth(0);

    // 画布边界框
    this.createCanvasBorder();

    // 表演按钮
    this.createPerformButton();

    // 撤回按钮
    this.createUndoButton();

    // 清空按钮
    this.createClearButton();

    // 背景切换按钮
    this.createBgButton();

    // 放置区提示文字（画布中央）
    this.add
      .text(canvasCenterX, canvasCenterY, '从左侧面板拖拽道具到画布上', {
        fontFamily: 'Rajdhani, PingFang SC, Microsoft YaHei, sans-serif',
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

    // 监听 React 发来的清空画布请求
    eventBus.on('request-clear-scene', () => {
      this.handleClear();
    });

    // 通知 React 场景就绪
    eventBus.emit('scene-ready');
  }

  private placeProp(key: PropKey, x: number, y: number): void {
    const manifest = PROP_MANIFEST[key];
    const id = `prop-${++propIdCounter}`;

    debugLog(`[EditorScene] 放置道具: id=${id} type=${key} pos=(${Math.round(x)},${Math.round(y)})`);

    // 表演碰撞使用粗网格快照推导，这里保持为普通图片对象即可。
    const img = this.add
      .image(x, y, manifest.key)
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

    // 通知 React
    eventBus.emit('prop-placed', { prop: placedProp });
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
        fontFamily: 'Orbitron, Rajdhani, sans-serif',
        fontSize: '10px',
        color: '#00f0ff',
      })
      .setOrigin(0, 0)
      .setDepth(4)
      .setAlpha(0.6);
  }

  private createPerformButton(): void {
    const btnX = 1120;
    const btnY = 934;

    this.performBtn = this.add
      .image(btnX, btnY, 'btn-perform')
      .setInteractive({ useHandCursor: true })
      .setDepth(20);

    this.performBtnText = this.add
      .text(btnX, btnY, '◈ PERFORM', {
        fontFamily: 'Orbitron, Rajdhani, sans-serif',
        fontSize: '15px',
        color: '#00f0ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.performBtn.on('pointerover', () => {
      this.performBtn.setScale(1.05);
      this.performBtnText.setScale(1.05);
    });
    this.performBtn.on('pointerout', () => {
      this.performBtn.setScale(1);
      this.performBtnText.setScale(1);
    });
    this.performBtn.on('pointerdown', () => {
      this.performBtn.setScale(0.95);
      this.performBtnText.setScale(0.95);
      this.handlePerform();
    });
  }

  private createUndoButton(): void {
    const btnX = 940;
    const btnY = 934;

    this.undoBtn = this.add
      .image(btnX, btnY, 'btn-undo')
      .setInteractive({ useHandCursor: true })
      .setDepth(20);

    this.undoBtnText = this.add
      .text(btnX, btnY, 'UNDO', {
        fontFamily: 'Orbitron, Rajdhani, sans-serif',
        fontSize: '12px',
        color: '#ff00a0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.undoBtn.on('pointerover', () => {
      this.undoBtn.setScale(1.05);
      this.undoBtnText.setScale(1.05);
    });
    this.undoBtn.on('pointerout', () => {
      this.undoBtn.setScale(1);
      this.undoBtnText.setScale(1);
    });
    this.undoBtn.on('pointerdown', () => {
      this.undoBtn.setScale(0.95);
      this.undoBtnText.setScale(0.95);
      this.handleUndo();
    });
  }

  private createClearButton(): void {
    const btnX = 800;
    const btnY = 934;

    this.clearBtn = this.add
      .image(btnX, btnY, 'btn-clear')
      .setInteractive({ useHandCursor: true })
      .setDepth(20);

    this.clearBtnText = this.add
      .text(btnX, btnY, 'CLEAR', {
        fontFamily: 'Orbitron, Rajdhani, sans-serif',
        fontSize: '12px',
        color: '#a855f7',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.clearBtn.on('pointerover', () => {
      this.clearBtn.setScale(1.05);
      this.clearBtnText.setScale(1.05);
    });
    this.clearBtn.on('pointerout', () => {
      this.clearBtn.setScale(1);
      this.clearBtnText.setScale(1);
    });
    this.clearBtn.on('pointerdown', () => {
      this.clearBtn.setScale(0.95);
      this.clearBtnText.setScale(0.95);
      this.handleClear();
    });
  }

  private createBgButton(): void {
    const btnX = 650;
    const btnY = 934;

    this.bgBtn = this.add
      .image(btnX, btnY, 'btn-bg')
      .setInteractive({ useHandCursor: true })
      .setDepth(20);

    this.bgBtnText = this.add
      .text(btnX, btnY, 'BG', {
        fontFamily: 'Orbitron, Rajdhani, sans-serif',
        fontSize: '12px',
        color: '#e7ff2f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.bgBtn.on('pointerover', () => {
      this.bgBtn.setScale(1.05);
      this.bgBtnText.setScale(1.05);
    });
    this.bgBtn.on('pointerout', () => {
      this.bgBtn.setScale(1);
      this.bgBtnText.setScale(1);
    });
    this.bgBtn.on('pointerdown', () => {
      this.bgBtn.setScale(0.95);
      this.bgBtnText.setScale(0.95);
      this.cycleBackground();
    });
  }

  private cycleBackground(): void {
    this.currentBg = (this.currentBg + 1) % this.bgTextures.length;
    this.canvasBg.setTexture(this.bgTextures[this.currentBg]);
    debugLog(`[EditorScene] 切换背景: ${this.bgTextures[this.currentBg]}`);
  }

  private handleUndo(): void {
    if (this.placedProps.length === 0) return;

    // 移除最后一个放置的道具
    const lastProp = this.placedProps.pop();
    if (!lastProp) return;

    // O(1) 从映射表找到对应的图像对象并销毁
    const img = this.propImageMap.get(lastProp.id);
    if (img) {
      img.destroy();
      this.propImageMap.delete(lastProp.id);
      this.propIdByImage.delete(img);
    }

    // 通知 React
    eventBus.emit('prop-removed', { propId: lastProp.id });
  }

  private handleClear(): void {
    if (this.placedProps.length === 0) return;

    debugLog(`[EditorScene] handleClear: 清除 ${this.placedProps.length} 个道具`);

    // O(n) 通过映射表销毁所有已放置道具
    for (const img of this.propImageMap.values()) {
      img.destroy();
    }
    this.propImageMap.clear();
    this.propIdByImage.clear();
    this.placedProps = [];

    debugLog(`[EditorScene] handleClear: 完成, propImageMap=${this.propImageMap.size}, placedProps=${this.placedProps.length}`);

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
      const effectCtx: EffectContext = { scene: this, imageMap };
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
        const done = this.time.delayedCall(AFTER_SCREENSHOT_DELAY_MS, safeResolve);
        // 安全兜底：5秒后强制 resolve，防止 timer 丢失导致永久等待
        const safety = this.time.delayedCall(5000, () => {
          debugWarn(`[EditorScene:${perfId}] 安全兜底触发! done.hasDispatched=${done.hasDispatched}`);
          safety.destroy();
          safeResolve();
        });
        // 如果 3100ms 正常触发，取消安全兜底
        const origCallback = done.callback;
        done.callback = () => {
          safety.destroy();
          if (origCallback) origCallback();
        };
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
  }
}
