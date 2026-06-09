// ============================================================
// BootScene — 预加载所有资源（赛博朋克直播风按钮纹理）
// ============================================================

import Phaser from 'phaser';
import { PROP_MANIFEST } from '../assets/manifest';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // 加载道具 PNG 纹理（优先），fallback 为代码生成的占位图
    this.loadPropTextures();

    // 加载 UI 资源
    this.createGridTexture();
    this.createBackgroundTextures();
    this.createButtonTextures();
  }

  private loadPropTextures(): void {
    // 尝试从 /assets/props/ 加载 PNG 素材
    Object.values(PROP_MANIFEST).forEach((manifest) => {
      const pngPath = `/assets/props/${manifest.key}.png`;
      this.load.image(manifest.key, pngPath);
    });

    // 加载失败时用代码生成的占位图兜底
    this.load.on('loaderror', (_file: { key: string }) => {
      const key = _file.key;
      const manifest = Object.values(PROP_MANIFEST).find((m) => m.key === key);
      if (manifest) {
        const [w, h] = manifest.size;
        const gfx = this.make.graphics({ x: 0, y: 0 });
        gfx.fillStyle(0x888888, 1);
        gfx.fillRoundedRect(0, 0, w, h, 4);
        gfx.lineStyle(2, 0xffffff, 0.3);
        gfx.strokeRoundedRect(0, 0, w, h, 4);
        gfx.generateTexture(key, w, h);
        gfx.destroy();
      }
    });
  }

  private createGridTexture(): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.lineStyle(2, 0x1a1a2e, 0.5);

    for (let x = 0; x <= 1280; x += 80) {
      gfx.moveTo(x, 0);
      gfx.lineTo(x, 960);
    }
    for (let y = 0; y <= 960; y += 80) {
      gfx.moveTo(0, y);
      gfx.lineTo(1280, y);
    }

    gfx.generateTexture('grid-bg', 1280, 960);
    gfx.destroy();
  }

  private createBackgroundTextures(): void {
    // 背景1：暗色纯色背景
    this.createSolidBg('bg-dark', 0x080810);

    // 背景2：演播室风格（深蓝渐变模拟）
    this.createStudioBg('bg-studio');

    // 背景3：霓虹暗色
    this.createNeonBg('bg-neon');
  }

  private createSolidBg(key: string, color: number): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(color, 1);
    gfx.fillRect(0, 0, 1280, 960);
    gfx.generateTexture(key, 1280, 960);
    gfx.destroy();
  }

  private createStudioBg(key: string): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    // 深蓝渐变模拟演播室背景
    gfx.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x050510, 0x050510, 1);
    gfx.fillRect(0, 0, 1280, 960);
    // 垂直聚光灯效果
    gfx.fillStyle(0x1a1a3e, 0.3);
    gfx.fillRect(440, 0, 400, 960);
    gfx.fillStyle(0x2a2a5e, 0.15);
    gfx.fillRect(540, 0, 200, 960);
    gfx.generateTexture(key, 1280, 960);
    gfx.destroy();
  }

  private createNeonBg(key: string): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(0x050508, 1);
    gfx.fillRect(0, 0, 1280, 960);
    // 霓虹网格线
    gfx.lineStyle(1, 0x1a1a3e, 0.4);
    for (let x = 0; x <= 1280; x += 160) {
      gfx.moveTo(x, 0);
      gfx.lineTo(x, 960);
    }
    for (let y = 0; y <= 960; y += 120) {
      gfx.moveTo(0, y);
      gfx.lineTo(1280, y);
    }
    gfx.generateTexture(key, 1280, 960);
    gfx.destroy();
  }

  private createButtonTextures(): void {
    // 开始表演按钮 - 霓虹青色
    this.createNeonButtonTexture('btn-perform', 0x00f0ff, 180, 48);
    // 撤回按钮 - 霓虹粉色
    this.createNeonButtonTexture('btn-undo', 0xff00a0, 110, 40);
    // 清空按钮 - 霓虹紫色
    this.createNeonButtonTexture('btn-clear', 0xa855f7, 110, 40);
    // 背景切换按钮 - 霓虹黄
    this.createNeonButtonTexture('btn-bg', 0xe7ff2f, 100, 40);
  }

  private createNeonButtonTexture(key: string, color: number, width: number, height: number): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });

    // 背景 - 半透明深色
    gfx.fillStyle(0x0a0a12, 0.9);
    gfx.fillRoundedRect(0, 0, width, height, 4);

    // 霓虹边框
    gfx.lineStyle(2, color, 1);
    gfx.strokeRoundedRect(0, 0, width, height, 4);

    // 顶部高光
    gfx.lineStyle(1, color, 0.5);
    gfx.moveTo(4, 2);
    gfx.lineTo(width - 4, 2);

    gfx.generateTexture(key, width, height);
    gfx.destroy();
  }

  create(): void {
    this.scene.start('EditorScene');
  }
}
