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
  private panelY = 32;
  private panelH = 148;
  /** 正在执行表演动画 */
  private isPerforming = false;

  constructor() {
    super({ key: 'EditorScene' });
  }

  create(): void {
    this.placedProps = [];
    propIdCounter = 0;

    // 网格背景 - 适配 720p
    this.add.image(640, 360, 'grid-bg').setAlpha(0.3);

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
      .text(640, 640, '将道具拖拽到画布上搭建场景', {
        fontFamily: 'Rajdhani, PingFang SC, Microsoft YaHei, sans-serif',
        fontSize: '20px',
        color: '#6b6b8a',
      })
      .setOrigin(0.5);

    // === 全局拖拽事件（只绑定一次，避免 20 次重复）===
    this.input.on(
      'dragstart',
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
        if (this.dragPropKey !== null) return;

        // 判断拖的是面板上的道具还是已放置的道具
        const idx = PROP_LIST.findIndex(
          (k) => PROP_MANIFEST[k].key === gameObject.texture.key,
        );
        if (idx !== -1) {
          // 从面板拖拽
          this.dragPropKey = PROP_LIST[idx];
          this.dragSprite = this.add
            .image(gameObject.x, gameObject.y, gameObject.texture.key)
            .setAlpha(0.7)
            .setDepth(10);
        } else if (gameObject.y > this.panelY + this.panelH) {
          // 拖拽已放置的道具
          this.dragSprite = gameObject;
          this.dragSprite.setAlpha(0.7).setDepth(10);
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

    this.input.on('dragend', () => {
      if (!this.dragSprite || !this.dragPropKey) {
        // 移动已放置道具
        if (this.dragSprite) {
          this.dragSprite.setAlpha(1).setDepth(5);
          // 更新 placedProps 中的位置
          const sprite = this.dragSprite;
          const prop = this.placedProps.find(
            (p) => Math.abs(p.x - sprite.x) < 5 && Math.abs(p.y - sprite.y) < 5
          );
          if (prop) {
            prop.x = Math.round(sprite.x);
            prop.y = Math.round(sprite.y);
            prop.positionDesc = this.describePosition(sprite.x, sprite.y);
          }
          this.dragSprite = null;
        }
        return;
      }

      const x = this.dragSprite.x;
      const y = this.dragSprite.y;

      // 检查是否在放置区（面板下方）
      if (y > this.panelY + this.panelH + 40) {
        this.placeProp(this.dragPropKey, x, y);
      }

      this.dragSprite.destroy();
      this.dragSprite = null;
      this.dragPropKey = null;
    });

    // 通知 React 场景就绪
    eventBus.emit('scene-ready');
  }

  private createPropPanel(): void {
    const panelW = 1280;

    this.propPanelBg = this.add.graphics();
    this.propPanelBg.fillStyle(0x0a0a12, 0.9);
    this.propPanelBg.fillRoundedRect(0, this.panelY, panelW, this.panelH, 8);
    this.propPanelBg.lineStyle(1, 0x1a1a2e, 1);
    this.propPanelBg.strokeRoundedRect(0, this.panelY, panelW, this.panelH, 8);

    // 顶部霓虹线
    this.propPanelBg.lineStyle(1, 0x00f0ff, 0.5);
    this.propPanelBg.moveTo(0, this.panelY);
    this.propPanelBg.lineTo(panelW, this.panelY);

    // 渲染道具图标，动态间距适应不同尺寸
    const totalIcons = PROP_LIST.length;
    const usableWidth = panelW - 120; // 左右留白
    const spacing = Math.min(64, usableWidth / totalIcons);

    PROP_LIST.forEach((key, i) => {
      const manifest = PROP_MANIFEST[key];
      const x = 60 + i * spacing + spacing / 2;
      const iconY = this.panelY + 48; // 图标偏上，给下方文字留空间

      const icon = this.add.image(x, iconY, manifest.key).setInteractive({ draggable: true });
      icon.setDisplaySize(56, 56);

      // 道具名称标签（图标下方）
      this.add.text(x, iconY + 38, manifest.label, {
        fontFamily: 'Rajdhani, PingFang SC, Microsoft YaHei, sans-serif',
        fontSize: '13px',
        color: '#8b8baa',
        align: 'center',
      }).setOrigin(0.5);
    });
  }

  private placeProp(key: PropKey, x: number, y: number): void {
    const manifest = PROP_MANIFEST[key];
    const id = `prop-${++propIdCounter}`;

    this.add
      .image(x, y, manifest.key)
      .setInteractive({ draggable: true })
      .setDepth(5);

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
    const hPos = x < 400 ? '左侧' : x > 880 ? '右侧' : '中央';
    const vPos = y < 320 ? '上方' : y > 640 ? '下方' : '中间';
    return `${hPos}${vPos}`;
  }

  private createPerformButton(): void {
    const btnX = 1100;
    const btnY = 680;

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
    const btnY = 680;

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
    const btnY = 680;

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

    // 找到对应的图像对象并销毁
    this.children.getAll().forEach((child) => {
      if (child.type === 'Image') {
        const img = child as Phaser.GameObjects.Image;
        if (
          img !== this.performBtn &&
          img !== this.undoBtn &&
          img !== this.clearBtn &&
          Math.abs(img.x - lastProp.x) < 5 &&
          Math.abs(img.y - lastProp.y) < 5
        ) {
          img.destroy();
        }
      }
    });

    // 通知 React
    eventBus.emit('prop-removed', { prop: lastProp });
  }

  private handleClear(): void {
    if (this.placedProps.length === 0) return;

    // 清空所有已放置的道具
    this.children
      .getAll()
      .filter((c) => {
        if (
          c === this.performBtn ||
          c === this.undoBtn ||
          c === this.clearBtn ||
          c === this.propPanelBg ||
          c.type !== 'Image'
        )
          return false;
        const img = c as Phaser.GameObjects.Image;
        return img.y > this.panelY + this.panelH && img.y < 860;
      })
      .forEach((c) => c.destroy());

    this.placedProps = [];

    // 通知 React
    eventBus.emit('scene-cleared');
  }

  private async handlePerform(): Promise<void> {
    if (this.placedProps.length === 0) {
      eventBus.emit('scene-error', { error: new Error('请至少放置一个道具') });
      return;
    }

    if (this.isPerforming) return;
    this.isPerforming = true;

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

    try {
      const connections = deriveEventChains(this.placedProps);
      const snapshot = toSnapshot(this.placedProps, connections);

      // === 第1步：截取动画前的画面 ===
      const beforeScreenshot = this.captureScreenshot();

      // === 第2步：播放3秒物理动画 ===
      const imageMap = this.buildImageMap();
      const effectCtx: EffectContext = { scene: this, imageMap };
      const effectDescriptions = executeAllEffects(this.placedProps, effectCtx, 3000);

      // 等待3秒动画结束
      await new Promise<void>((resolve) => {
        this.time.delayedCall(3100, resolve);
      });

      // === 第3步：截取动画后的画面 ===
      const afterScreenshot = this.captureScreenshot();

      // === 第4步：发送给 AI（截图 + 描述）===
      eventBus.emit('perform-requested', {
        snapshot,
        beforeScreenshot,
        afterScreenshot,
        effectDescriptions,
      });
    } catch (err) {
      eventBus.emit('scene-error', { error: err instanceof Error ? err : new Error('表演执行失败') });
    } finally {
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
    }
  }

  /** 截取 Phaser Canvas 画布为 base64 图片 */
  private captureScreenshot(): string {
    const canvas = this.sys.game.canvas as HTMLCanvasElement;
    return canvas.toDataURL('image/png');
  }

  /** 构建已放置道具的 Image 映射表 */
  private buildImageMap(): Map<string, Phaser.GameObjects.Image> {
    const map = new Map<string, Phaser.GameObjects.Image>();
    this.children.getAll().forEach((child) => {
      if (
        child.type === 'Image' &&
        child !== this.performBtn &&
        child !== this.undoBtn &&
        child !== this.clearBtn &&
        child !== this.propPanelBg
      ) {
        const img = child as Phaser.GameObjects.Image;
        // 排除面板上的道具图标（y 坐标在面板区域内）
        if (img.y > this.panelY + this.panelH + 20) {
          // 通过位置匹配已放置的道具
          for (const prop of this.placedProps) {
            if (Math.abs(img.x - prop.x) < 5 && Math.abs(img.y - prop.y) < 5) {
              map.set(prop.id, img);
              break;
            }
          }
        }
      }
    });
    return map;
  }

  /** 外部调用：清空场景 */
  clearScene(): void {
    this.placedProps = [];
    propIdCounter = 0;
    this.children
      .getAll()
      .filter((c) => {
        if (
          c === this.performBtn ||
          c === this.undoBtn ||
          c === this.clearBtn ||
          c === this.propPanelBg
        )
          return false;
        if (c.type !== 'Image') return false;
        const img = c as Phaser.GameObjects.Image;
        return img.y > this.panelY + this.panelH && img.y < 860;
      })
      .forEach((c) => c.destroy());
  }
}
