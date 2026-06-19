# 《不许笑》v4.0 更新日志

**版本 4.0 | 基于 v3.0 架构的五场景环境系统 + 悬崖物理重构**

---

## 零、v4.0 改动概览

| 类别 | 文件数 | 新增行 | 改动行 | 核心模块 |
|------|--------|--------|--------|---------|
| 场景系统 | 4 | 500+ | 30 | EditorScene (悬崖/河流/黑暗/暴风), ScenePanel, types |
| 音效系统 | 1 | 190 | 10 | AudioManager (5 场景环境音 + 坠落音 + AudioContext 恢复) |
| 道具效果 | 1 | 30 | 20 | PropEffectSystem (onPostTick 回调机制) |
| UI 文案 | 3 | 5 | 5 | AICommentCard, usePerform, gameStore (裁判→质检员) |
| BGM | 1 | 80 | 10 | bgmGenerator (赛博朋克合成器重构) |
| 演出层 | 2 | 40 | 20 | LiveStage, usePerform (沉默文案/场景上下文) |
| **合计** | **15** | **975** | **118** | |

---

## 一、五场景环境系统（核心新增）

### 1.1 概述

v3.0 只有普通直播间舞台。v4.0 新增 **5 种可切换的场景环境**，每种改变物理规则和视觉效果：

| 场景 | Key | 中文名 | 物理效果 | 视觉 |
|------|-----|--------|---------|------|
| 普通 | `normal` | 无 | 默认重力，无特殊效果 | 标准舞台 |
| 悬崖 | `cliff` | 悬崖 | 右侧高台平台，左边缘过红线即坠落 | 红线标记 + 平台可视化 |
| 猛龙过江 | `rapids` | 猛龙过江 | 底部 160px 河流，道具浮起被冲走 | 蓝色波纹动画 + 飞溅粒子 |
| 至暗时刻 | `darkness` | 至暗时刻 | 表演前全黑遮罩，开始后揭开 | 黑色遮罩 + 灯光效果 |
| 暴风 | `windstorm` | 暴风 | 所有道具被向上吹飞飘舞 | 白色风粒子 |

### 1.2 ScenePanel 组件

新增左侧竖排场景选择栏（`src/components/ScenePanel.tsx`），72px 宽，选中的场景带青色高亮：

```
┌──────────────────────────────────────────┐
│ [SCENE] │                                │
│         │                                │
│ ● 无    │      Phaser 画布                │
│   悬崖  │                                │
│   猛龙  │                                │
│   黑暗  │                                │
│   暴风  │                                │
└──────────────────────────────────────────┘
```

状态存储在 Zustand `sceneType: SceneType`，通过 EventBus 通知 Phaser。

---

## 二、悬崖物理系统（重构）

### 2.1 问题背景

v3.0 悬崖使用简单的 `img.x > limit` 判断，存在以下问题：

1. **位置判定不准**：仅用中心点判断，大尺寸主角身体悬空一半还不掉
2. **道具效果冲突**：表演时 PropEffectSystem 每帧将位置重置回 `origY`，悬崖坠落被弹回，永远悬空
3. **执行顺序错误**：`update()` 在道具 tick 之前执行，永远慢一拍
4. **靠近就掉**：没有明确的过线判定

### 2.2 v4.0 解决方案

#### 三层架构

```
PropEffectSystem tick (道具效果移动道具)
       │
       └─→ onPostTick 回调 (EffectContext)
              │
              └─→ applyCliffEffect(true) 强制覆盖位置
```

#### 左边缘判定

```typescript
// 道具左边缘过红线 = 整个身体在悬崖右边 → 掉下去
const leftEdge = img.x - Math.abs(img.displayWidth) * 0.45;
if (leftEdge >= platformEndX) {
  // 坠落！
}
```

#### 绝对位置追踪（`cliffFallY` Map）

```typescript
// 初次过线记录当前实际 Y 作为下落起点
let fallY = this.cliffFallY.get(id);
if (fallY === undefined) {
  fallY = img.y;        // 起点 = 当前真实位置
  vy = 8;               // 过线瞬间立即获得大初速
}
vy = Math.min(vy + 1.2, 16);
fallY += vy;
img.y = fallY;          // 绝对位置覆盖，不被道具 tick 弹回
```

#### `performOnly` 双模式

| 模式 | 平台区道具 | 过线道具 | 调用方式 |
|------|----------|---------|---------|
| 编辑模式 | 正常重力 + 弹跳 | 加速坠落消失 | `applyCliffEffect()` |
| 表演模式 | 跳过（由 PropEffectSystem 控制） | 强制坠落（优先级最高） | `applyCliffEffect(true)` |

### 2.3 悬崖坠落效果

- **过线瞬间**：获得 `vy = 8` 初速（不悬空）+ 播放 `ambient_cliff_fall` 音效
- **下落过程**：加速度 1.2/帧，最大速度 16，旋转 `vy * 0.6`，横向飘出 `x += 0.5`
- **消失判定**：`fallY > CANVAS_BOTTOM + 40` 时销毁道具

### 2.4 EffectContext.onPostTick

`src/phaser/systems/PropEffectSystem.ts` 新增回调：

```typescript
export interface EffectContext {
  // ... 原有字段
  /** 每帧所有道具 tick 执行完毕后的回调（用于悬崖掉落等场景效果强制覆盖） */
  onPostTick?: () => void;
}

// 主循环中：
callback: () => {
  // 1. 执行所有道具 tick
  for (let i = 0; i < ticks.length; i++) ticks[i](elapsed);
  // 2. 场景效果覆盖（悬崖掉落），在所有道具 tick 之后强制运行
  if (ctx.onPostTick) ctx.onPostTick();
}
```

---

## 三、猛龙过江（河流系统）

### 物理规则

- 河流区域：画布底部 160px
- 道具底部进入河流 → 不再受默认重力，改为浮力晃荡 + 向右冲走
- 水流速度：2.5px/帧
- 被冲走过程：轻微摇晃 `Math.sin(time * 0.01 + i) * 0.5`
- 冲出画布右侧 → 产生水花飞溅粒子 → 道具销毁

### 视觉效果

- 蓝色渐层水面（`0x004488` → `0x0066cc` → `0x0099ee`）
- 水面波纹动画（`riverOverlay` 每帧重绘）
- 道具落水到消失有飞溅粒子

---

## 四、至暗时刻（黑暗模式）

- **编辑时**：全黑遮罩覆盖画布（`Rect` 填黑色 `0x000000` opacity 1.0）
- **表演开始时**：遮罩渐隐消失（alpha 从 1 到 0），露出舞台
- **表演结束后**：遮罩恢复
- **AI 提示词扩展**：注入 `"舞台处于至暗时刻——表演开始前完全漆黑一片！灯光突然亮起的瞬间表演才揭开"` 作为场景上下文

---

## 五、暴风模式

- **暴风粒子**：白色矩形粒子从左向右斜向上飘
- **道具物理**：所有道具被吹飞，x 方向漂移 + y 方向上升
- **轻道具**：可能直接被吹出画布并消失
- **风音效**：`ambient_windstorm` 循环播放（间隔 1500ms）

---

## 六、音效系统升级

### 6.1 场景环境音效（Web Audio API 合成）

| 音效 Key | 场景 | 合成方式 | 间隔 |
|---------|------|---------|------|
| `ambient_cliff` | 悬崖 | 呼啸风声 + 碎石掉落（噪声 + 高频振荡器） | 1800ms |
| `ambient_cliff_fall` | 坠落 | 急速下坠"嗖~" + 撞击 | 一次性 |
| `ambient_rapids` | 河流 | 流水声 + 水花飞溅（低频噪声 + 带通滤波） | 2000ms |
| `ambient_windstorm` | 暴风 | 狂风呼啸 + 物体飞旋 | 1500ms |
| `ambient_darkness` | 黑暗 | 低沉压迫感 + 心悸脉冲（正弦波 LFO） | 2500ms |

### 6.2 AudioContext 恢复

- 用户首次点击/触摸时自动恢复 suspended AudioContext
- 静音失效修复：确保每次播放前 AudioContext 处于 running 状态

### 6.3 编辑/表演音效

- `ambient_editing`：编辑时底部轻背景音
- `ambient_performing`：表演中紧张节奏音

---

## 七、UI 文案统一（裁判 → 质检员）

| 文件 | 旧文案 | 新文案 |
|------|--------|--------|
| `AICommentCard.tsx` | `REFEREE` | `INSPECTOR` |
| `usePerform.ts` | `'裁判打了个盹'` | `'质检员打了个盹'` |
| `gameStore.ts` | `'跳过裁判评分，直接获得5分'` | `'跳过质检员评分，直接获得5分'` |

---

## 八、重力开关

```typescript
// 全局重力开关按钮（画布右上角）
private gravityEnabled = true;  // 默认开启
```

- 关闭时：所有道具浮空不落下，场景效果也跳过
- 按钮切换：`gravityBtn` + 文字 "GRAVITY ON/OFF"
- 悬崖/暴风模式下默认重力被场景特效接管

---

## 九、BGM 生成器重构

`src/utils/bgmGenerator.ts`：

- 赛博朋克风格 3 分钟可无缝循环电子乐
- 支持外部 AudioContext 注入（`setOutput(ctx, dest)`）
- 多轨道合成（低音线 + 鼓组 + 旋律 + 氛围垫）
- 播放/暂停/音量控制

---

## 十、沉默回合 UX 改进

```typescript
const SILENCE_MESSAGES: Record<number, string> = {
  1: '阿乐笑得说不出话了…',
  2: '小七："这集我看过了吧？"',
  3: '老陈潜水了，没有弹幕…',
  4: '林老师沉默地摇了摇头',
  5: '零号评审在笔记上写了些什么',
};
```

不同难度沉默时展示不同的 NPC 反应文本，而非通用的"观众沉默了"。

---

## 十一、场景上下文注入 AI Prompt

每个场景类型向 AI 注入对应的环境描述：

```typescript
const SCENE_CONTEXT_DESC: Record<SceneType, string> = {
  normal: '标准直播间舞台，无特殊环境效果，重力正常。',
  cliff: '舞台地面是一个向右下倾斜的巨大斜坡（悬崖）！...',
  rapids: '舞台底部是湍急的河流——"猛龙过江"！...',
  darkness: '舞台处于"至暗时刻"——表演开始前完全漆黑一片！...',
  windstorm: '舞台正经历暴风天气！所有道具被斜向上的狂风吹得飘舞旋转...',
};
```

---

## 十二、关键技术决策

| 决策 | 原因 |
|------|------|
| `onPostTick` 而非独立定时器 | 必须保证悬崖检查在道具 tick 之后执行，同一调度队列 |
| `cliffFallY` 绝对位置 Map | 抵抗 PropEffectSystem 每帧 `img.y = origY + wobble` 的位置重置 |
| 左边缘判定而非中心点 | 整个身体过线才掉，视觉效果和红线完全对齐 |
| 过线瞬间 `vy = 8` | 不悬空，立即坠落的观感 |
| Web Audio API 合成而非音频文件 | 零额外资源文件，运行时合成，参数可实时调整 |
| SceneType 只存 Zustand | Rendering 层不直接持有 Phaser 引用 |

---

## 附录：文件改动清单

```
src/audio/AudioManager.ts              | 190 行 (+-)  场景环境音效 + AudioContext 恢复
src/components/AICommentCard.tsx       |  16 行 (+-)  裁判→质检员 INSPECTOR
src/components/ApiKeyInput.tsx         |   2 行 (+-)
src/components/LiveStage.tsx           |  12 行 (+-)  ScenePanel 集成 + 沉默文案
src/components/ResultModal.tsx         |   2 行 (+-)
src/components/ScenePanel.tsx          |  65 行 (新)  场景选择侧栏
src/components/Shop.tsx                |   2 行 (+-)
src/hooks/useBgm.ts                    |  16 行 (+-)
src/hooks/usePerform.ts                |  38 行 (+-)  沉默文案 + 场景上下文
src/phaser/scenes/EditorScene.ts       | 578 行 (+-)  五场景系统 + 悬崖物理重构
src/phaser/systems/PropEffectSystem.ts |  51 行 (+-)  onPostTick 回调机制
src/store/gameStore.ts                 |   8 行 (+-)  场景状态 + 文案
src/types/index.ts                     |  24 行 (新)  SceneType/SceneConfig 定义
src/utils/bgmGenerator.ts              |  86 行 (+-)  外部 AudioContext 注入
src/utils/buildMotionRelationGraph.ts  |   3 行 (+-)
────────────────────────────────────────────────────
     15 files, 975 insertions, 118 deletions
```
