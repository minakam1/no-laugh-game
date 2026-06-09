// ============================================================
// EditorScene — 道具拖拽 + 物理放置 + 触发器 + 撤回/清空
// ============================================================

import Phaser from 'phaser';
import { PROP_MANIFEST, PROP_LIST, PropKey } from '../assets/manifest';
import { eventBus } from '../bridges/PhaserEventBus';
import { toSnapshot, deriveEventChains } from '../systems/Serialization';
import { executeAllEffects, type EffectContext } from '../systems/PropEffectSystem';
import type { PlacedProp } from '@/types';

let propIdCounter = 0;

export class EditorScene extends Phaser.Scene {
  private placedProps: PlacedProp[] = [];
  private dragSprite: Phaser.GameObjects.Image | null = null;
  private dragPropKey: PropKey | null = null;
  private propPanelBg!: Phaser.GameObjects.Graphics;
  private performBtn!: Phaser.GameObjects.Image;
  private performBtnText!: Phaser.GameObjects.Text;
  private undoBtn!: Phaser.GameObjects.Image;
  private undoBtnText!: Phaser.GameObjects.Text;
  private clearBtn!: Phaser.GameObjects.Image;
  private clearBtnText!: Phaser.GameObjects.Text;
  private panelY = 24;
  private panelH = 260;
  /** 正在执行表演动画 */
  private isPerforming = false;
  /** 已放置道具 id -> Image 快速映射（O(1) 查找，替代 O(n*m) 遍历） */
  private propImageMap = new Map<string, Phaser.GameObjects.Image>();

  constructor() {
    super({ key: 'EditorScene' });
  }

  create(): void {
    this.placedProps = [];
    this.propImageMap.clear();
    propIdCounter = 0;

    console.log('[EditorScene] create: 场景初始化');

    // 网格背景 - 适配 4:3 (1280x960)
    this.add.image(640, 480, 'grid-bg').setAlpha(0.3);

    // 道具面板
    this.createPropPanel();

    // 表演按钮
    this.createPerformButton();

    // 撤回按钮
    this.createUndoButton();

    // 清空按钮
    this.createClearButton();

    // 放置区提示文字
    this.add
      .text(640, 880, '将道具拖拽到画布上搭建场景', {
        fontFamily: 'Rajdhani, PingFang SC, Microsoft YaHei, sans-serif',
        fontSize: '20px',
        color: '#6b6b8a',
      })
      .setOrigin(0.5);

    // === 全局拖拽事件（只绑定一次，避免 20 次重复）===
    // 记录每个已放置道具的原始位置，用于拖拽后匹配
    const placedOriginalPositions = new Map<string, { x: number; y: number }>();

    this.input.on(
      'dragstart',
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
        if (this.dragPropKey !== null) return;

        // 判断拖的是面板上的道具还是已放置的道具
        const idx = PROP_LIST.findIndex(
          (k) => PROP_MANIFEST[k].key === gameObject.texture.key,
        );
        if (idx !== -1 && gameObject.y <= this.panelY + this.panelH + 20) {
          // 从面板拖拽：创建副本
          this.dragPropKey = PROP_LIST[idx];
          this.dragSprite = this.add
            .image(gameObject.x, gameObject.y, gameObject.texture.key)
            .setAlpha(0.7)
            .setDepth(10);
        } else if (gameObject.y > this.panelY + this.panelH + 20) {
          // 拖拽已放置的道具：直接用原对象
          this.dragSprite = gameObject;
          this.dragSprite.setAlpha(0.7).setDepth(10);
          // O(1) 通过映射表查找对应的 prop
          for (const [id, img] of this.propImageMap) {
            if (img === gameObject) {
              placedOriginalPositions.set(id, { x: gameObject.x, y: gameObject.y });
              break;
            }
          }
        }
      },
    );

    this.input.on(
      'drag',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObject: Phaser.GameObjects.Image,
        dragX: number,
        dragY: number,
      ) => {
        if (this.dragSprite) {
          this.dragSprite.setPosition(dragX, dragY);
        }
      },
    );

    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, _gameObject: Phaser.GameObjects.Image) => {
      // 情况1：从面板拖拽新道具（dragPropKey 有值）
      if (this.dragPropKey && this.dragSprite) {
        const x = this.dragSprite.x;
        const y = this.dragSprite.y;

        // 检查是否在放置区（面板下方）
        if (y > this.panelY + this.panelH + 40) {
          this.placeProp(this.dragPropKey, x, y);
        }

        // 销毁拖拽时的临时精灵（是复制品，不是面板原图标）
        this.dragSprite.destroy();
        this.dragSprite = null;
        this.dragPropKey = null;
        return;
      }

      // 情况2：拖拽已放置的道具（dragPropKey 为 null，dragSprite 是原对象）
      if (this.dragSprite && !this.dragPropKey) {
        this.dragSprite.setAlpha(1).setDepth(5);
        const sprite = this.dragSprite;
        // 用原始位置匹配（dragend时sprite.x已变，不能用当前位置）
        let matchedProp: PlacedProp | undefined;
        for (const [propId, origPos] of placedOriginalPositions) {
          if (Math.abs(origPos.x - sprite.x) < 100 && Math.abs(origPos.y - sprite.y) < 100) {
            matchedProp = this.placedProps.find(p => p.id === propId);
            break;
          }
        }
        if (matchedProp) {
          matchedProp.x = Math.round(sprite.x);
          matchedProp.y = Math.round(sprite.y);
          matchedProp.positionDesc = this.describePosition(sprite.x, sprite.y);
          placedOriginalPositions.delete(matchedProp.id);
        }
        this.dragSprite = null;
        return;
      }
    });

    // 通知 React 场景就绪
    eventBus.emit('scene-ready');
  }

  private createPropPanel(): void {
    const panelW = 1280;
    const itemsPerRow = 10; // 每行10个道具
    const rowSpacing = 110; // 行间距

    this.propPanelBg = this.add.graphics();
    this.propPanelBg.fillStyle(0x0a0a12, 0.9);
    this.propPanelBg.fillRoundedRect(0, this.panelY, panelW, this.panelH, 8);
    this.propPanelBg.lineStyle(1, 0x1a1a2e, 1);
    this.propPanelBg.strokeRoundedRect(0, this.panelY, panelW, this.panelH, 8);

    // 顶部霓虹线
    this.propPanelBg.lineStyle(1, 0x00f0ff, 0.5);
    this.propPanelBg.moveTo(0, this.panelY);
    this.propPanelBg.lineTo(panelW, this.panelY);

    // 渲染道具图标，两行自动换行
    const usableWidth = panelW - 80; // 左右留白
    const colSpacing = Math.min(110, usableWidth / itemsPerRow);

    PROP_LIST.forEach((key, i) => {
      const manifest = PROP_MANIFEST[key];
      const row = Math.floor(i / itemsPerRow);
      const col = i % itemsPerRow;
      const x = 40 + col * colSpacing + colSpacing / 2;
      const iconY = this.panelY + 30 + row * rowSpacing;

      const icon = this.add.image(x, iconY, manifest.key).setInteractive({ draggable: true });
      icon.setDisplaySize(48, 48);

      // 道具名称标签（图标下方）
      this.add.text(x, iconY + 32, manifest.label, {
        fontFamily: 'Rajdhani, PingFang SC, Microsoft YaHei, sans-serif',
        fontSize: '11px',
        color: '#8b8baa',
        align: 'center',
      }).setOrigin(0.5);
    });
  }

  private placeProp(key: PropKey, x: number, y: number): void {
    const manifest = PROP_MANIFEST[key];
    const id = `prop-${++propIdCounter}`;

    console.log(`[EditorScene] 放置道具: id=${id} type=${key} pos=(${Math.round(x)},${Math.round(y)})`);

    // 表演碰撞使用粗网格快照推导，这里保持为普通图片对象即可。
    const img = this.add
      .image(x, y, manifest.key)
      .setInteractive({ draggable: true })
      .setDepth(5);

    // 注册到快速映射表
    this.propImageMap.set(id, img);

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
    const hPos = x < 427 ? '左侧' : x > 853 ? '右侧' : '中央';
    const vPos = y < 360 ? '上方' : y > 720 ? '下方' : '中间';
    return `${hPos}${vPos}`;
  }

  private createPerformButton(): void {
    const btnX = 1100;
    const btnY = 900;

    this.performBtn = this.add
      .image(btnX, btnY, 'btn-perform')
      .setInteractive({ useHandCursor: true })
      .setDepth(20);

    this.performBtnText = this.add
      .text(btnX, btnY, '◈ PERFORM', {
        fontFamily: 'Orbitron, Rajdhani, sans-serif',
        fontSize: '16px',
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
    const btnY = 900;

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
    const btnY = 900;

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
    }

    // 通知 React
    eventBus.emit('prop-removed', { prop: lastProp });
  }

  private handleClear(): void {
    if (this.placedProps.length === 0) return;

    console.log(`[EditorScene] handleClear: 清除 ${this.placedProps.length} 个道具`);

    // O(n) 通过映射表销毁所有已放置道具
    for (const img of this.propImageMap.values()) {
      img.destroy();
    }
    this.propImageMap.clear();
    this.placedProps = [];

    console.log(`[EditorScene] handleClear: 完成, propImageMap=${this.propImageMap.size}, placedProps=${this.placedProps.length}`);

    // 通知 React
    eventBus.emit('scene-cleared');
  }

  private async handlePerform(): Promise<void> {
    const perfId = `perf-${Date.now() % 100000}`;
    console.group(`[EditorScene:${perfId}] === 开始表演 ===`);

    if (this.placedProps.length === 0) {
      console.warn(`[EditorScene:${perfId}] 没有道具，跳过`);
      console.groupEnd();
      eventBus.emit('scene-error', { error: new Error('请至少放置一个道具') });
      return;
    }

    if (this.isPerforming) {
      console.warn(`[EditorScene:${perfId}] 正在表演中，跳过重复调用`);
      console.groupEnd();
      return;
    }
    this.isPerforming = true;

    console.log(`[EditorScene:${perfId}] 道具数量: ${this.placedProps.length}, propImageMap大小: ${this.propImageMap.size}`);

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
      console.log(`[EditorScene:${perfId}] 道具 ${id}: pos=(${img.x.toFixed(0)},${img.y.toFixed(0)}) active=${img.active} visible=${img.visible}`);
    }

    try {
      const connections = deriveEventChains(this.placedProps);
      console.log(`[EditorScene:${perfId}] 碰撞链数量: ${connections.length}`);
      const snapshot = toSnapshot(this.placedProps, connections);

      // === 第1步：截取动画前的画面 ===
      console.log(`[EditorScene:${perfId}] 步骤1: 截取表演前截图`);
      const beforeScreenshot = this.captureScreenshot();
      console.log(`[EditorScene:${perfId}] 截图前: ${beforeScreenshot.length} 字符`);

      // === 第2步：播放3秒物理动画 ===
      console.log(`[EditorScene:${perfId}] 步骤2: 开始效果动画`);
      const imageMap = this.buildImageMap();
      const effectCtx: EffectContext = { scene: this, imageMap };
      const effectDescriptions = executeAllEffects(this.placedProps, effectCtx, 3000);
      console.log(`[EditorScene:${perfId}] 效果数量: ${effectDescriptions.length}`);
      for (const desc of effectDescriptions) {
        console.log(`[EditorScene:${perfId}]   效果: ${desc}`);
      }

      // 等待3秒动画结束（安全上限5秒防止卡死）
      console.log(`[EditorScene:${perfId}] 等待3100ms...`);
      await new Promise<void>((resolve) => {
        let resolved = false;
        const safeResolve = () => {
          if (!resolved) {
            resolved = true;
            console.log(`[EditorScene:${perfId}] Promise resolved`);
            resolve();
          }
        };
        const done = this.time.delayedCall(3100, safeResolve);
        // 安全兜底：5秒后强制 resolve，防止 timer 丢失导致永久等待
        const safety = this.time.delayedCall(5000, () => {
          console.warn(`[EditorScene:${perfId}] 安全兜底触发! done.hasDispatched=${done.hasDispatched}`);
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
      console.log(`[EditorScene:${perfId}] 等待完成，检查道具状态...`);
      for (const [id, img] of this.propImageMap) {
        console.log(`[EditorScene:${perfId}]   道具 ${id}: pos=(${img.x.toFixed(0)},${img.y.toFixed(0)}) active=${img.active} visible=${img.visible} alpha=${img.alpha.toFixed(2)}`);
      }

      // === 第3步：截取动画后的画面 ===
      console.log(`[EditorScene:${perfId}] 步骤3: 截取表演后截图`);
      const afterScreenshot = this.captureScreenshot();
      console.log(`[EditorScene:${perfId}] 截图后: ${afterScreenshot.length} 字符`);

      // === 第4步：发送给 AI（截图 + 描述）===
      console.log(`[EditorScene:${perfId}] 步骤4: 发送perform-requested事件`);
      eventBus.emit('perform-requested', {
        snapshot,
        beforeScreenshot,
        afterScreenshot,
        effectDescriptions,
      });
      console.log(`[EditorScene:${perfId}] === 表演成功完成 ===`);
    } catch (err) {
      console.error(`[EditorScene:${perfId}] 表演异常:`, err);
      eventBus.emit('scene-error', { error: err instanceof Error ? err : new Error('表演执行失败') });
    } finally {
      console.log(`[EditorScene:${perfId}] finally: 清理和恢复...`);
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
      console.log(`[EditorScene:${perfId}] finally: 恢复了 ${restoredCount}/${this.propImageMap.size} 个道具`);

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
      console.log(`[EditorScene:${perfId}] === 表演清理完成 ===`);
      console.groupEnd();
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
  }
}
