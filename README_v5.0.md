# 《不许笑》v5.0 更新日志

**版本 5.0 | v4.0 后的 UI 布局重构 + 质检员卡片压缩**

---

## 一、v5.0 改动概览

| 文件 | 新增 | 改动 | 说明 |
|------|------|------|------|
| `src/components/AICommentCard.tsx` | 60 | 70 | 完整重写：紧凑单行浮层 + 动作链折叠 |
| `src/components/LiveStage.tsx` | 38 | 31 | 舞台绝对定位 + 中央「继续」按钮 |
| **合计** | **110** | **89** | **2 文件** |

---

## 二、UI 布局重构

### 2.1 v4.0 布局问题

- 质检员卡片在画布下方占用独立行，压缩了舞台可用高度
- 道具面板和弹幕栏被底栏截断，未延展满高

### 2.2 v5.0 新布局

```
┌─────────────────────────────────────────────────┐
│  顶栏 (LIVE, 头肯, 进度条, 按钮)                  │
├───────┬──────┬─────────────────────┬─────────────┤
│PropPanel│Scene │ Phaser 画布 (绝对铺满)│  弹幕栏     │
│       │Panel │                    │  (满高)     │
│ (延长) │(延长) │ ┌────────────────┐ │             │
│       │      │ │ 继续下一回合(中央)│ │             │
│       │      │ └────────────────┘ │             │
│       │      ├────────────────────┤             │
│       │      │ AICommentCard(覆盖) │             │
└───────┴──────┴─────────────────────┴─────────────┘
```

**关键改动**：
- Phaser 画布外层改为 `relative` 容器，画布 `absolute inset-0` 完全铺满
- 质检员卡片 `absolute bottom-0` 覆盖在画布底部，不占用额外空间
- 「继续下一回合」按钮 `absolute` 居中叠加在舞台中央
- PROCESSING 反应条同样覆盖在画布底部

---

## 三、AICommentCard 紧凑化重写

### 3.1 v4.0 卡片结构

```
┌──────────────────────────────────────────┐
│ [AI头像 大]  INSPECTOR // 淡定上班族       │
│              +7.5  (DECAY ×0.65)         │
│                                           │
│  "质检员沉默不语"                          │
│                                           │
│  SCORE 7  GAIN +10.5  ROUND #5           │
│                                           │
│  MOTION CHAIN                             │
│  banana → springGlove → trampoline        │
│  moved 3 / effects 2                     │
│  香蕉皮让主角滑向弹簧拳套，被弹起后...     │
└──────────────────────────────────────────┘
高度: ~120-180px, 独立占用空间
```

### 3.2 v5.0 紧凑浮层

```
┌──────────────────────────────────────────┐
│ [AI] INSPECTOR//淡定上班族 "质检员沉默不语" 得分7 增益+10.5 ×0.65 #5 [▼ CHAIN] │
└──────────────────────────────────────────┘
高度: ~28px 单行, 覆盖在画布底部

点击 [▼ CHAIN] 展开:
┌──────────────────────────────────────────┐
│ [AI] INSPECTOR//淡定上班族 "质检员沉默不语" 得分7 增益+10.5 ×0.65 #5 [▲ CHAIN] │
│ MOTION CHAIN banana→springGlove→trampoline moved 3 / effects 2 │
│ 香蕉皮让主角滑向弹簧拳套，被弹起后落到了蹦床上...                       │
└──────────────────────────────────────────┘
```

**设计要点**：
- 单行布局：头像(20px) + 质检员名 + 评语(truncate) + 数据徽章 + 展开按钮
- 动作链细节折叠为可展开面板，默认隐藏节省空间
- 背景 `bg-black/85 backdrop-blur-sm` 半透明毛玻璃，不影响查看舞台
- 得分/增益/回合 用中文徽章展示（"得分7""增益+10.5""#5"）
- 等待状态同样精简为单行

### 3.3 不删减原则

| 原有信息 | v5.0 处理方式 |
|----------|-------------|
| INSPECTOR 标识 + 难度名 | 保留，单行内 |
| 实际增益 + 衰减因子 | 保留，徽章格式 |
| 质检员评语原因 | 保留，truncate 截断 |
| SCORE / GAIN / ROUND | 保留，中文徽章 |
| MOTION CHAIN 详情 | 折叠面板，点击展开 |
| 沉默/等待文案 | 保留，单行内 |

---

## 四、舞台中央「继续」按钮

```tsx
{/* 覆盖在 Phaser 画布正中央，带毛玻璃和发光边框 */}
<div className="absolute inset-0 flex items-center justify-center z-20">
  <button className="px-6 py-3 border-2 border-accent
                      bg-game-surface/90 backdrop-blur-md
                      text-accent font-cyber text-xs tracking-widest
                      hover:bg-accent hover:text-black
                      shadow-lg shadow-accent/20 active:scale-95">
    ◈ 质检员已出报告 — 点击继续下一回合 ◈
  </button>
</div>
```

**效果**：舞台正中央浮动大按钮，hover 时反转配色（青色背景+黑字），点击缩放反馈。

---

## 五、PhaserCanvas 尺寸保证

v5.0 的布局确保 Phaser 画布尺寸不受质检员卡片影响：

```
外层: relative overflow-hidden (固定边界)
  └─ PhaserCanvas: absolute inset-0 → 始终占满整个容器
  └─ AICommentCard: absolute bottom-0 → 覆盖在画布上方，不改变容器尺寸
  └─ 继续按钮: absolute inset-0 → 居中覆盖，不改变容器尺寸
```

这样画布的 `width/height` 完全由外层容器决定，质检员卡片的高度不影响画布。

---

## 附录：v4.0 → v5.0 文件 diff

```
src/components/AICommentCard.tsx | 130 lines (+-)  紧凑单行浮层重写
src/components/LiveStage.tsx     |  69 lines (+-)  绝对定位布局重构
─────────────────────────────────────────────────
     2 files, 110 insertions, 89 deletions
```
