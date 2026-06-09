# 《不许笑》腾讯云黑客松技术方案

**赛事：AI CAN DO IT | 腾讯云黑客松 游戏开发挑战赛**
版本 3.0 | 基于 AI 审查 17 条建议全面重构架构

---

## 一、赛题选择与对齐策略

### 选择：赛题三——叙事类游戏（开放探索类）

比赛原文要求"涌现式叙事——故事并非预先编写，而是从AI与玩家的互动中自然生长"。《不许笑》的核心循环正是：**玩家创作场景 → AI 实时生成反应 → AI 裁判打分**，笑点不可预测，每局都不同。AI 在这里不是辅助工具，是**核心玩家**。

### 评分维度对齐

| 评分项 | 分值 | 《不许笑》的应对 |
|--------|------|----------------|
| 主题契合度 | 30分 | 深度契合"AI重塑叙事体验"，AI 同时扮演观众和裁判两个角色 |
| AI工具使用 | 40分 | 双重 AI 调用（AI观众 + AI裁判）、CodeBuddy开发、SCF云函数 |
| 游戏品质 | 30分 | 5级难度阶梯、绷不住值可量化、笑点衰减机制、双模式 |
| 加分项 | +5分 | 发布小红书/视频号 + #CodeBuddy #腾讯云黑客松 |

---

## 二、核心玩法设计

### 2.1 游戏循环

```
场景搭建 (玩家) → 运动关系观察包 → AI观众理解并反应 → AI裁判评分 → 绷不住值结算 → 下一回合
```

### 2.2 双模式设计

| 模式 | 规则 | 目标 |
|------|------|------|
| **故事模式** | 5个难度依次挑战，每关10回合 | 10回合累计绷不住值达标 → 解锁下一关；5关全通过 = 毕业 |
| **无尽模式** | 自选难度，无限回合 | 冲击最高分，练习技巧 |

### 2.3 绷不住值系统

- **基础值**：0-100，每回合根据裁判评分累加
- **满分增益**：裁判打10分 → +15点（基础公式：`(score/10) × 15`）
- **笑点衰减**：同类梗重复使用，每次效果递减 `max(0, 1 - 使用次数 × 0.35)`
- **故事模式通关线**：10回合累计绷不住值 ≥ 通关线（当前实现为 30）
- **胜败反馈**：绷不住值达标的回合有特效动画 + AI观众的特殊反应

---

## 三、系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     玩家浏览器                           │
│                                                         │
│  ┌──────────────┐   ┌──────────────┐  ┌─────────────┐ │
│  │  场景编辑器   │ → │  直播演出模块  │→ │  绷不住值UI  │ │
│  │ (Phaser.js)  │   │ (Live Stage) │  │  (HUD)      │ │
│  └──────────────┘   └──────┬───────┘  └─────────────┘ │
│                            │ Observation Packet + 配置   │
└────────────────────────────┼────────────────────────────┘
                             │ HTTPS (TLS)
                             ▼
┌─────────────────────────────────────────────────────────┐
│           腾讯云 SCF 云函数（轻量后端）                   │
│                                                         │
│  1. 注入系统提示词（5级难度人格，对玩家隐藏）               │
│  2. 发起第1次调用（SSE 流式优先，不支持则降级）             │
│  3. 收集完整回复 → 第2次调用（AI裁判，极短输出）           │
│  4. 返回 { reaction, funnyScore, reason }               │
└─────────────────────────────────────────────────────────┘
         │ 第1次调用 (流式SSE)         │ 第2次调用 (非流式)
         ▼                              ▼
┌──────────────────────────────────────────────────────────┐
│               玩家配置的 AI API (OpenAI 兼容)              │
│                                                          │
│  第1次: 扮演 AI 观众，流式输出弹幕                          │
│  第2次: 扮演 AI 裁判，严格 JSON 输出评分                    │
│  两次调用共用同一 API Key，零额外成本                        │
└──────────────────────────────────────────────────────────┘
```

### API Key 安全设计（开发直连 + 生产代理）

```
本地开发：浏览器 → localhost / 127.0.0.1 OpenAI-compatible API
生产演示：浏览器 → SCF /api/perform → AI API

API Key：sessionStorage 临时保存；localStorage 只保存 baseUrl、model、Key 后四位 hint
服务端：可用 SCF 环境变量 AI_API_KEY 托管演示 Key，前端无需持有完整 Key
```

**关键防护**：本地模型保留直连以方便开发；非本地生产演示走云函数代理，系统提示词和服务端 Key 不进入前端长期存储。

### 3.3 Simulation 与 Rendering 分层设计

**问题**：旧方案中 BreakdownMeter 游戏核心规则直接埋在 React 组件的 useRef 中，与 UI 渲染层耦合——典型的"renderer 作为 truth source"反模式。

**改进**：提取独立的 GameState 系统（Simulation 层），用 Zustand 做轻量状态管理，React 组件只订阅需要的切片：

```typescript
// Simulation 层（纯逻辑，无 UI 依赖）
interface GameState {
  meter: BreakdownMeter;          // 绷不住值计算引擎
  currentLevel: number;           // 当前关卡
  currentRound: number;           // 当前回合
  mode: 'story' | 'endless';     // 模式
  unlockedLevels: number;         // 故事模式进度持久化
  history: RoundRecord[];         // 回合历史
  phase: 'editing' | 'performing' | 'judging' | 'result'; // 游戏阶段
}

// Zustand Store（连接 Simulation ↔ Rendering）
// React 组件通过 selector 订阅，不直接持有 game loop 状态
const useGameStore = create<GameState>((set, get) => ({
  // ... Zustand actions
}));

// React 组件只订阅需要的切片
function BreakdownBar() {
  const value = useGameStore(s => s.meter.value);
  const level = useGameStore(s => s.currentLevel);
  // ...
}
```

### 3.4 存档系统设计

**可序列化的 SaveData 接口**（只存 simulation 状态，不存 renderer 对象）：

```typescript
interface SaveData {
  version: number;              // 存档格式版本号，便于未来迁移
  storyProgress: {
    unlockedLevels: number;     // 已解锁关卡数
    bestScores: Record<number, number>;  // 每关最高平均分
  };
  endlessBest: {
    highScore: number;          // 无尽模式最高分
    bestLevel: number;          // 达到的最高难度
  };
  settings: {
    apiKeyHint: string;         // 仅存后4位，不存完整Key
  };
  savedAt: number;              // 存档时间戳
}
```

**存档策略**：
- 存储介质：`localStorage`（优先）或 IndexedDB（大容量备选）
- 触发时机：每关结算后自动存档，模式切换时存档
- 启动入口：增加"继续游戏"按钮，加载存档恢复进度
- 安全：不序列化 Phaser Game 实例、不存完整 API Key

### 3.5 通讯层修正：POST + ReadableStream + 流式降级

**问题**：旧方案使用 EventSource，只能发 GET 请求，场景描述通过 Query Params 传输。长文本容易触发 URL 长度限制（~8KB），且 API Key 暴露在 URL 中。

**改进**：使用 `fetch + ReadableStream` 手动解析 SSE，通过 POST body 安全传输：

```
浏览器 → POST /perform (JSON body: {observation, level, model, apiKey?})
       → SCF 注入提示词 → 第1次 AI 调用 (stream:true 优先)
       → SCF 收集完整 reaction → 第2次 AI 裁判调用
       → SCF 通过同一 SSE 连接返回 reaction_delta / reaction_done / score
       → 一次请求，完整数据
```

如果上游本地 API 不支持 `stream:true` 或多模态输入，则自动降级为普通响应，并由前端逐字播放，保证演示体验稳定。

---

## 四、AI 提示词体系（核心章节）

### 4.1 提示词设计哲学

提示词通过**三个可控维度**实现难度递进，而非依赖随机性：

| 维度 | 定义 | LV1→LV5 的变化 |
|------|------|---------------|
| **笑点阈值** | 触发反应的刺激强度下限 | 从"什么都笑"到"几乎不笑" |
| **语言风格** | 弹幕的用词、字数、情绪浓度 | 从热情夸张到冷漠极简 |
| **互动意愿** | 是否愿意主动发弹幕反馈 | 从无条件积极到几乎沉默 |

### 4.2 五级难度递进对比

| | LV1 快乐小狗 | LV2 好奇大学生 | LV3 淡定上班族 | LV4 文艺鉴赏家 | LV5 冷面裁判官 |
|---|---|---|---|---|---|
| **一句话概括** | 什么都觉得好笑 | 懂梗但开始挑 | 老观众，潜水为主 | 只吃高级幽默 | 基本不可能逗笑 |
| **典型反应** | "哈哈哈哈哈哈哈笑死我了" | "这个好！有点东西" | "还行""嗯"（偶尔） | "精妙的结构" | "……有点意思" |
| **笑点触发条件** | 任何物理意外/谐音梗 | 有创意的组合/网络梗 | 新鲜的多道具连锁 | 荒诞/反讽/结构错位 | 几乎无法触发 |
| **重复梗免疫** | 几乎无 | 轻度："看过" | 明显："又是这招" | 强烈：直接无视 | 绝对：从不回应 |
| **平均回复字数** | 15-30字 | 10-20字 | 1-8字 | 0-20字 | 0-8字 |
| **弹幕活跃度** | 每回合必回 | 90%回合回复 | 30-50%回合回复 | 10-30%回合回复 | 5-10%回合回复 |
| **故事模式通关线** | 平均 ≥ 5分/回合 | 平均 ≥ 6分/回合 | 平均 ≥ 7分/回合 | 平均 ≥ 7.5分/回合 | 平均 ≥ 8分/回合（10回合总平均）† |

> † **LV5 通关线说明**：`平均 ≥ 8分/回合` 指的是 10 个回合的裁判平均分 ≥ 8，而非单个回合。由于 LV5 沉默率高达 90-95%，玩家需要在仅有的 1-2 次非沉默回合中拿到近乎满分来拉高平均。这在实践中极其困难，设计意图是让 LV5 成为"荣誉挑战"关卡。

### 4.3 提示词结构模板

每条观众提示词包含5个区块：

```
┌──────────────────────────────┐
│  [角色设定]                   │  ← 姓名、年龄、身份、生活背景
│    让 AI 有人味               │     建立代入感和一致性
├──────────────────────────────┤
│  [你的性格]                   │  ← 核心人格描述
│    约束行为边界               │     定义"自然反应"的范围
├──────────────────────────────┤
│  [你会被什么逗到]              │  ← 正向引导
│    定义笑点触发域             │     列表形式,具体、可执行
├──────────────────────────────┤
│  [你不会被什么逗到]            │  ← 负向约束
│    定义免疫区                 │     与正向对称,形成清晰边界
├──────────────────────────────┤
│  [你的语言风格]               │  ← 输出规范
│    高频词、句式、字数限制       │     确保玩家能区分不同难度
│    [输出规则]（分层注入）       │     强制弹幕格式，禁止角色扮演
│      LV1-LV4: 不超过50字          │     LV5 单独使用不超过10字的规则
└──────────────────────────────┘
```

裁判提示词包含4个区块：

```
┌──────────────────────────────┐
│  [角色设定]                   │  ← 幽默反应分析系统
│    明确不是主观判断"好不好笑"    │
├──────────────────────────────┤
│  [评分锚点]                   │  ← 0-10 分每段有具体定义
│    减少模糊空间               │     提供典型文本特征对照
├──────────────────────────────┤
│  [输出格式]                   │  ← JSON: funny_score + reason
│    多层兜底约束               │     违规自检清单 + 示例
├──────────────────────────────┤
│  [分析任务]                   │  ← 运行时注入观众回复文本
│    包含难度校准提示            │     同一句话在不同难度下分值不同
└──────────────────────────────┘
```

### 4.4 裁判评分锚点

| 分数 | 含义 | 观众反应典型文本 |
|------|------|-----------------|
| 0 | 完全无反应/敷衍 | "嗯""过""知道了""……" |
| 1-2 | 极微弱,未表达 | "还行""好吧""下一个" |
| 3-4 | 有一丝可取 | "有点意思""还行吧""可以" |
| 5-6 | 确实被逗到,正面反馈 | "哈哈哈""有趣""这个好" |
| 7-8 | 情绪被调动,强烈反应 | "笑死我了""绷不住了""绝了" |
| 9-10 | 情绪满溢/失控 | 高难度下几乎不会出现 |

**难度校准原则**：同样说"有点意思"，LV5 的分值应远高于 LV1。裁判需根据观众人格的基线校准。

### 4.7 裁判难度校准系数表

为解决审查建议 #16（裁判缺少量化校准标准），在云函数 `prompts.js` 中为裁判提示词附加了明确的难度权重表：

| 难度 | 基线系数 | 说明 | 示例：观众说"有点意思"→ |
|------|---------|------|------------------------|
| LV1 | 1.0 | 基线，"哈哈哈" = 7分 | "有点意思" = 2分（对LV1来说太冷静）|
| LV2 | 1.1 | 轻微挑剔 | "有点意思" = 4分 |
| LV3 | 1.3 | 潜水观众，"草" = 8分 | "有点意思" = 5分 |
| LV4 | 1.6 | 文艺鉴赏，"精妙" = 9分 | "有点意思" = 6分 |
| LV5 | 2.5 | 终极评审，"有点意思" = 10分 | "有点意思" = 9-10分（破防级）|

**校准方法**：先根据回复文本内容打出原始分，乘以难度系数，再根据该难度的稀有度微调。

### 4.5 各难度详细人格设定

#### LV1 快乐小狗 — 阿乐, 21岁, 养柯基的快乐打工人

**核心特质**：笑点≈0，发自内心觉得世界有趣。谐音梗能笑五分钟，猫摔倒能笑到打嗝。不是演的，是真的乐。

**语言DNA**：必带"哈"字，高频词"笑死""绷不住了""救命""我不行了""好家伙"。

---

#### LV2 好奇大学生 — 小七, 22岁, B站六级号, 冲浪达人

**核心特质**：阅梗无数，一般的烂活会说"就这？"。但好奇心重，遇到从没见过的创意会兴奋得像发现新大陆。不是难逗，是见过世面。

**语言DNA**：弹幕老哥气质，"典""难绷""好活/烂活""当赏""这集我看过"。

---

#### LV3 淡定上班族 — 老陈, 34岁, 加班回来挂直播当背景音

**核心特质**：潜水观众，大多数时候只看不发。不值得的内容不会浪费手指打字。内心有朴素的幽默细胞，但要被真正好东西戳中才会浮出水面。

**语言DNA**：极简，"……""还行""嗯""知道了"。真正被逗到时会说"草""绝了""今天这个还行"。

---

#### LV4 文艺鉴赏家 — 林老师, 41岁, 巴黎留学戏剧理论, 独立评论人

**核心特质**：看普通整活像看幼儿园小朋友学猪叫。不鄙视大众，修养够好不说刻薄话，但沉默本身就是态度。对幽默有自己的哲学："真正好笑的是笑了之后意识到'我为什么会笑这个'。"

**语言DNA**：写影评的画风，"有趣的结构""这个转折有点意思""细节见功力"。最高评价："精妙。""荒诞主义的正确打开方式。""有布列松的味道。"

---

#### LV5 冷面裁判官 — 零号评审, 年龄不详, 阅评过十万场表演

**核心特质**：不是不会笑，是标准已被拔高到普通人难以理解的高度。地质层级的存在——绝大多数表演不留痕迹。本身就是挑战："让零号评审动容"是最高荣誉。

**语言DNA**：99%的时间只说"嗯""知道了""下一个"。如果他真的说"……有点意思"、"不坏"、"值得一看"，这就是破防了。对零号评审而言，"有点意思"是最高评价。

### 4.6 难度过渡的感知设计

玩家在通关后进入下一难度时，会立刻感受到 AI "变难了"：

| 过渡 | 核心变化 | 玩家感受 |
|------|---------|---------|
| LV1→LV2 | 从"什么都笑"到"开始说看过" | "咦，这个 AI 开始挑剔了" |
| LV2→LV3 | 从"活跃弹幕"到"潜水偶尔冒泡" | "他怎么不说话了？？" |
| LV3→LV4 | 从"说人话"到"文艺腔评论" | "我需要动脑子想剧本了" |
| LV4→LV5 | 从"偶尔被逗到"到"铁板一块" | "这怎么可能？？？" |

---

## 五、核心模块技术方案

### 5.1 场景编辑器（Scene Lab）

**道具系统设计：**
- 道具库约 20 件：香蕉皮、传送门、弹射板、呆萌 NPC、定时炸弹、弹跳蘑菇、磁铁地板、烟雾机、假天花板、反向重力区、咖啡杯、自行车、滑板、蹦床、胶水地毯、喷气背包、吹风机、镜子、弹簧拳套、旋转舞台
- 玩家拖拽道具放置到 Phaser.js 画布，可设置触发器（碰撞/点击/定时）

**道具分类标签（用于笑点衰减系统）：**

```typescript
const PROP_TAGS: Record<string, PropKey[]> = {
  'physical':    ['banana', 'springGlove', 'coffeeCup', 'trampoline'],  // 物理道具
  'explosive':   ['bomb', 'barrel'],                                    // 爆炸类
  'transport':   ['portal', 'trampoline', 'jetpack'],                   // 传送/位移
  'npc':         ['clumsyNpc', 'coffeeCup'],                            // NPC交互
  'environment': ['banana', 'springGlove', 'bomb'],                     // 环境改造
  'gadget':      ['smokeMachine', 'mirror', 'springGlove'],             // 机关道具
};
```

**ActionType 定义（笑点衰减分类依据）：**

```typescript
type ActionType =
  | 'prop:single'       // 单一道具效果
  | 'prop:combo'        // 多道具组合（如香蕉皮+弹射板）
  | 'chain:reaction'    // 连锁反应（3个以上道具联动）
  | 'prop:mixed';       // 其他组合（2-3个道具但非连锁）

function classifyAction(props: PlacedProp[], chains: EventChain[]): ActionType {
  if (chains.length >= 3) return 'chain:reaction';
  if (props.length >= 3 && chains.length >= 2) return 'prop:combo';
  if (props.length === 1 && chains.length <= 1) return 'prop:single';
  return 'prop:mixed';  // 其余情况（2个道具+1个链等），不做语义假设
}
```

**SceneSnapshot 接口（前端序列化，POST body 传输）：**

```typescript
interface SceneSnapshot {
  props: PlacedProp[];          // 已放置的道具
  connections: EventChain[];    // 事件链
  timestamp: number;            // 创建时间戳
}

interface PlacedProp {
  id: string;
  type: string;                 // 道具类型 key
  x: number;
  y: number;
  rotation: number;
  triggers: TriggerConfig[];    // 触发器配置
}

interface EventChain {
  id: string;
  steps: EventStep[];           // 连锁事件步骤
}

interface EventStep {
  type: 'collision' | 'trigger' | 'reaction';
  subject: string;
  target: string;
  result: string;
}
```

**SceneSnapshot → Motion Relation Graph（只记录运动/关系事实）：**

```typescript
interface MotionObject {
  id: string;
  type: string;
  label: string;
  start: { x: number; y: number; angle: number; scaleX: number; scaleY: number; alpha: number };
  end: { x: number; y: number; angle: number; scaleX: number; scaleY: number; alpha: number };
  delta: { x: number; y: number };
  motion: string[];       // move / rotate / scale_pulse / flicker 等
  affordances: string[];  // slip / rebound / teleport / spill 等
}

interface MotionRelation {
  type: 'near' | 'overlap' | 'moved_toward' | 'moved_away' | 'possible_chain';
  a?: string;
  b?: string;
  sequence?: string[];
  distance?: number;
  change?: number;
  confidence?: number;
}

interface ObservationPacket {
  version: number;
  durationMs: number;
  graph: {
    objects: MotionObject[];
    relations: MotionRelation[];
    summary: MotionSummary;
  };
  effects: string[];
  capturedAt: number;
}
```

**关键原则**：系统不替玩家生成"主播踩香蕉皮然后爆炸"这样的故事文本，只提供物体前后状态、运动标签、空间关系、可能连锁和截图。幽默、反差、剧情感由 AI 观众自行理解。

### 5.2 AI 调用系统（fetch + ReadableStream POST，单端点）

**关键改进**（解决审查建议 #8/#9/#10）：
- 使用 `fetch + ReadableStream` 替代 `EventSource`（POST body 传输，避免 URL 长度限制和 API Key 暴露）
- 云函数单端点返回完整数据（reaction 流式 + 最终 JSON），消除浏览器两次请求
- 前端 `AbortController` 去重，防止双击创建多个连接

**浏览器端请求代码：**

```typescript
// 使用 fetch + ReadableStream 手动解析 SSE，通过 POST body 安全传输
const abortRef = useRef<AbortController | null>(null);
const [error, setError] = useState<string | null>(null);

// 沉默文案映射（审查建议 #6）
const SILENCE_MESSAGES: Record<number, string> = {
  1: '阿乐笑得说不出话了…',
  2: '小七："这集我看过了吧？"',
  3: '老陈潜水了，没有弹幕…',
  4: '林老师沉默地摇了摇头',
  5: '零号评审在笔记上写了些什么',
};

const handlePerform = async (snapshot: SceneSnapshot) => {
  // 防止重复点击（审查建议 #10）
  if (isLoading) return;
  abortRef.current?.abort();
  abortRef.current = new AbortController();

  setIsLoading(true);
  setReaction("");
  setError(null);

  try {
    const observation = buildObservationPacket({
      props,
      chains,
      before,
      after,
      effects,
      durationMs,
    });
    const response = await fetch('/api/perform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        observation,
        level: currentLevel,
        apiKey,          // Key 在 POST body + TLS，不在 URL 中
      }),
      signal: abortRef.current.signal,
    });

    // HTTP 错误分类（审查建议 #7）
    if (!response.ok) {
      const errorMap: Record<number, string> = {
        401: 'API Key 无效，请检查后重试',
        429: '请求太频繁，请稍后再试',
        500: 'AI 服务异常，请稍后重试',
        504: 'AI 响应超时，请简化场景或重试',
      };
      setError(errorMap[response.status] || `请求失败 (${response.status})`);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          // 统一使用纯文本标记（审查建议 #3）
          if (data === '[REACTION_DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.funnyScore !== undefined) {
              // 结算：一次请求同时拿到 reaction + score + reason
              submitResult({
                reaction: parsed.reaction,
                funnyScore: parsed.funnyScore,
                reason: parsed.reason,
                actualGain: 0,    // 由 submitResult 内部计算
                decayFactor: 0,
                props: snapshot.props,
                chains: snapshot.connections,
              });

              // 沉默回合 UX（审查建议 #6）
              if (parsed.isSilence) {
                setReaction(SILENCE_MESSAGES[currentLevel] || '观众沉默了…');
              }
            }
          } catch {
            // 流式弹幕 chunk
            setReaction(prev => prev + data);
          }
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return;
    if (err.name === 'TypeError') {
      setError('网络连接失败，请检查网络后重试');
    } else {
      setError('发生未知错误，请稍后重试');
    }
    console.error('表演请求失败:', err);
  } finally {
    setIsLoading(false);
  }
};
```

**云函数入口（完整代码结构，与 5.2 配套）：**

```javascript
// 云函数：同一 SSE 连接内完成双重 AI 调用，单次返回完整数据
const { audience, judge } = require('./prompts.js');

/**
 * SCF 流式响应实现说明：
 * 腾讯云 SCF（API 网关触发器）默认只返回单次 JSON 响应，不原生支持 SSE 长连接。
 * 本方案采用「伪流式」策略：SCF 收集 AI 的完整反应后，一次性构造 SSE 格式的
 * 字符串并设置 Content-Type: text/event-stream 返回。浏览器端 ReadableStream
 * 解析后模拟逐 token 渲染（通过延迟发送或前端逐字打字效果）。
 *
 * 如果后续升级到腾讯云「函数 URL」触发器（支持流式响应），可改为真正逐 chunk 转发。
 * 当前方案的优势：实现简单、不依赖特殊触发器、与现有 API 网关兼容。
 */
const DIFFICULTY_MAX_TOKENS = {
  1: 80,   // LV1 快乐小狗：热情话多
  2: 60,   // LV2 大学生：正常弹幕长度
  3: 40,   // LV3 上班族：极简，通常几个字
  4: 50,   // LV4 鉴赏家：可能出现长篇评论
  5: 20,   // LV5 冷面裁判：最多10字
};

exports.main = async (event) => {
  // SCF API 网关触发器：event.body 是 JSON 字符串，必须 parse
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event;
  const { observation, difficulty, userApiKey } = body;

  // === 第一次调用：AI 观众反应 ===
  const systemPrompt = audience[`lv${difficulty}`];
  // 系统提示词仅存于云函数代码，玩家抓包不可见

  const audienceResult = await callLLM(userApiKey, {
    model: "gpt-4o-mini",
    system: systemPrompt,
    user: `你正在观看一段道具表演。以下是运动关系观察包：${JSON.stringify(observation)}\n\n请作为直播间观众，自行理解后发弹幕。`,
    stream: false,  // SCF 限流式：收集完整回复后一次性返回
    max_tokens: DIFFICULTY_MAX_TOKENS[difficulty] || 60,
  });

  const fullReaction = (audienceResult || "").trim();

  // === 判断是否为沉默回合 ===
  const SILENCE_KEYWORDS = ['过', '嗯', '知道了', '下一个', '……'];
  const isSilence = !fullReaction
    || SILENCE_KEYWORDS.includes(fullReaction)
    || fullReaction.length <= 2;

  // === 第二次调用：AI 裁判评分（沉默回合也评分，因为"沉默"在高难度下有意义）===
  const judgeResult = await callLLM(userApiKey, {
    model: "gpt-4o-mini",
    system: judge,
    user: `观众难度：${difficulty}\n观众回复：${fullReaction || '(观众沉默，未发弹幕)'}`,
    stream: false,
    max_tokens: 50,
  });

  let funnyScore, reason;
  try {
    const parsed = JSON.parse(judgeResult);
    funnyScore = parsed.funny_score;
    reason = parsed.reason;
  } catch (e) {
    funnyScore = 5;
    reason = "裁判打了个盹";
  }

  // 构造 SSE 格式响应，包含 reaction_done 标记和最终结果
  const sseBody = [
    `data: ${fullReaction}`,
    `data: [REACTION_DONE]`,
    `data: ${JSON.stringify({ reaction: fullReaction, funnyScore, reason, isSilence })}`,
  ].join('\n\n');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
    body: sseBody,
  };
};
```

**调用时序优化（对比旧方案）：**

| | 旧方案 | 新方案（v3.0） |
|------|------|------|
| 传输方式 | EventSource GET + query params | fetch POST body (TLS) |
| 浏览器请求次数 | 2次（SSE + fetchScore） | 1次（单端点） |
| API Key 位置 | URL 参数（不安全） | POST body（TLS加密） |
| 请求去重 | 无 | AbortController |
| 第一次感知延迟 | ~1秒（首 token） | ~1秒（首 token） |
| 总用户感知延迟 | 2-3秒 | 2-3秒 |

### 5.3 绷不住值系统 + GameState（Zustand）

**核心改进**（解决审查建议 #1/#3）：BreakdownMeter 从 React useRef 迁移到 Zustand GameState，同时明确定义 ActionType。

```typescript
// ============ Simulation 层（纯逻辑，无 UI 依赖）============

interface RoundRecord {
  funnyScore: number;
  actualGain: number;
  actionType: ActionType;
  decayFactor: number;
  reaction: string;
  reason: string;
}

interface GameState {
  // 绷不住值
  meter: {
    value: number;
    rounds: RoundRecord[];
    decayMap: Record<string, number>;
  };

  // 游戏进度
  currentLevel: number;
  currentRound: number;
  maxRounds: number;         // 故事模式=10，无尽模式=Infinity
  mode: 'story' | 'endless';
  phase: 'editing' | 'performing' | 'judging' | 'result';

  // 故事模式持久化
  unlockedLevels: number;
  bestScores: Record<number, number>;  // 每关最高平均增益

  // 无尽模式记录
  endlessHighScore: number;
  endlessBestLevel: number;

  // Actions（在 Zustand store 中实现）
  startRound: () => void;
  submitResult: (result: RoundResult) => void;
  nextLevel: () => void;
  reset: () => void;
}

// Zustand Store
const useGameStore = create<GameState>((set, get) => ({
  meter: { value: 0, rounds: [], decayMap: {} },
  currentLevel: 1,
  currentRound: 1,
  maxRounds: 10,
  mode: 'story',
  phase: 'editing',
  unlockedLevels: 1,
  bestScores: {},
  endlessHighScore: 0,
  endlessBestLevel: 1,

  submitResult(result) {
    const state = get();
    const { meter, mode, currentLevel, currentRound, maxRounds } = state;
    const actionType = classifyAction(result.props, result.chains);
    const useCount = (meter.decayMap[actionType] || 0);
    const decayFactor = Math.max(0.1, 1 - useCount * 0.35);
    const baseGain = (result.funnyScore / 10) * 15;
    const actualGain = baseGain * decayFactor;
    const newValue = Math.min(100, meter.value + actualGain);

    const roundRecord: RoundRecord = {
      funnyScore: result.funnyScore,
      actualGain: Math.round(actualGain * 10) / 10,
      actionType,
      decayFactor,
      reaction: result.reaction,
      reason: result.reason,
    };

    const newRound = currentRound + 1;
    // 无尽模式不结算，只有故事模式在10回合后进入结算（审查建议 #5）
    const isLevelComplete = mode === 'story' && newRound > maxRounds;

    const updates: Partial<GameState> = {
      meter: {
        value: newValue,
        rounds: [...meter.rounds, roundRecord],
        decayMap: {
          ...meter.decayMap,
          [actionType]: useCount + 1,
        },
      },
      currentRound: newRound,
      phase: isLevelComplete ? 'result' : 'editing',
    };

    // 故事模式通关结算（审查建议 #10）
    if (isLevelComplete) {
      const avgGain = newValue / maxRounds;
      const difficultyConfig = DIFFICULTY_CONFIG[currentLevel];
      const passed = avgGain >= difficultyConfig.targetAvgScore;

      updates.unlockedLevels = passed
        ? Math.max(state.unlockedLevels, currentLevel + 1)
        : state.unlockedLevels;

      updates.bestScores = {
        ...state.bestScores,
        [currentLevel]: Math.max(
          state.bestScores[currentLevel] || 0,
          Math.round(avgGain * 10) / 10
        ),
      };
    }

    // 无尽模式最高分更新
    if (mode === 'endless') {
      const totalScore = newValue + state.currentRound; // 回合数也加分
      updates.endlessHighScore = Math.max(state.endlessHighScore, totalScore);
      updates.endlessBestLevel = Math.max(state.endlessBestLevel, currentLevel);
    }

    set(updates);
  },

  nextLevel() {
    set(s => ({
      currentLevel: s.mode === 'story'
        ? Math.min(s.currentLevel + 1, s.unlockedLevels)
        : s.currentLevel + 1,
      currentRound: 1,
      meter: { value: 0, rounds: [], decayMap: {} },
      phase: 'editing',
    }));
  },

  reset() {
    set({
      meter: { value: 0, rounds: [], decayMap: {} },
      currentRound: 1,
      phase: 'editing',
    });
  },
}));

// 难度配置表（审查建议 #10 配套）
const DIFFICULTY_CONFIG: Record<number, DifficultyConfig> = {
  1: { level: 1, name: '快乐小狗', baselineCoefficient: 1.0, targetAvgScore: 5, maxRounds: 10 },
  2: { level: 2, name: '好奇大学生', baselineCoefficient: 1.1, targetAvgScore: 6, maxRounds: 10 },
  3: { level: 3, name: '淡定上班族', baselineCoefficient: 1.3, targetAvgScore: 7, maxRounds: 10 },
  4: { level: 4, name: '文艺鉴赏家', baselineCoefficient: 1.6, targetAvgScore: 7.5, maxRounds: 10 },
  5: { level: 5, name: '冷面裁判官', baselineCoefficient: 2.5, targetAvgScore: 8, maxRounds: 10 },
};
```

**衰减表格（同类梗连续使用效果）：**

| 使用次数 | 衰减因子 | 10分满分→实际增益 |
|---------|---------|------------------|
| 第1次 | 1.0 | +15.0 |
| 第2次 | 0.65 | +9.75 |
| 第3次 | 0.30 | +4.5 |
| 第4次 | 0.10（保底） | +1.5 |
| 第5次+ | 0.10（保底） | +1.5 |

### 5.4 前端直播 UI（V3 重构：Zustand + 移动端 + 主题系统）

**CSS 主题系统**（解决审查建议 #13）：

```css
:root {
  --theme-bg-primary: #0a0a0f;
  --theme-bg-secondary: #14141f;
  --theme-bg-card: #1a1a2e;
  --theme-accent-laugh: #f59e0b;     /* 绷不住值颜色 */
  --theme-accent-calm: #64748b;      /* LV3/LV5 冷色调 */
  --theme-accent-danger: #ef4444;    /* 衰减警告 */
  --theme-accent-success: #22c55e;   /* 达标/通关 */
  --theme-text-primary: #f1f5f9;
  --theme-text-secondary: #94a3b8;
  --theme-text-muted: #475569;
  --theme-border: #1e293b;
  --theme-font-display: 'Noto Sans SC', sans-serif;
  --theme-font-mono: 'JetBrains Mono', monospace;
  --danmaku-max-items: 100;          /* 弹幕历史上限 */
}
```

**响应式布局策略**（解决审查建议 #11）：

| 设备 | 布局方式 | Phaser 画布 | 弹幕区 |
|------|---------|-------------|--------|
| Desktop (≥1024px) | 左右分栏 60/40 | 固定 640×480 | 侧边滚动 |
| Tablet (768-1023px) | 左右分栏 60/40 | 自适应缩放 | 侧边滚动 |
| Mobile (<768px) | 垂直堆叠 | 上半屏，触摸拖拽 | 底部抽屉，可折叠 |

**桌面端布局：**
```
┌──────────────────────────────────────────────────┐
│  [绷不住值 ████████░░ 76/100]  LV3 淡定上班族     │
│                       第 5/10 回合                 │
├──────────────────────┬───────────────────────────┤
│                      │  🎯 "草，这个有点绝"        │
│   Phaser.js          │                            │
│   场景画布            │  "还行" → "……" → "还行"    │
│   (拖拽道具)         │  弹幕滚动区 (overflow-y)    │
│                      │                            │
│                      │  ────────────────          │
│                      │  裁判：情绪被调动           │
├──────────────────────┴───────────────────────────┤
│               [换一批道具]  [开始表演]             │
└──────────────────────────────────────────────────┘
```

**移动端布局：**
```
┌─────────────────────────┐
│  绷不住值 76/100 LV3     │
│  第 5/10 回合            │
├─────────────────────────┤
│                         │
│   Phaser.js 场景画布     │
│   (触摸拖拽道具)        │
│                         │
├─────────────────────────┤
│  🎯 "草，这个有点绝"     │
│  ─────────────────────  │
│  弹幕区 (滑动抽屉)      │
│  裁判：情绪被调动        │
├─────────────────────────┤
│  [换道具] [开始表演]    │
└─────────────────────────┘
```

**核心组件（Zustand 订阅模式）：**

```tsx
function LiveStage() {
  // Zustand 切片订阅（替代旧方案中 8 个 useState + useRef）
  const phase = useGameStore(s => s.phase);
  const meterValue = useGameStore(s => s.meter.value);
  const currentLevel = useGameStore(s => s.currentLevel);
  const currentRound = useGameStore(s => s.currentRound);
  const mode = useGameStore(s => s.mode);
  const rounds = useGameStore(s => s.meter.rounds);
  const submitResult = useGameStore(s => s.submitResult);
  const nextLevel = useGameStore(s => s.nextLevel);

  // 本地 UI 状态（仅渲染层需要）
  const [reaction, setReaction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 弹幕列表（限制100条，解决内存泄漏）
  const danmakuList = useMemo(() =>
    rounds.slice(-100).map(r => ({
      text: r.reaction,
      score: r.funnyScore,
      round: rounds.indexOf(r) + 1,
    })),
  [rounds]);

  // 注意：handlePerform 接收 Observation Packet
  // → 发送运动/关系事实与截图 → 接收 reaction + score → submitResult
  const handlePerform = async (snapshot: SceneSnapshot) => {
    if (isLoading) return;  // 前端拦截双击（#10）
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    // ... fetch + ReadableStream POST（见 5.2 完整代码）
  };

  return (
    <div className="live-stage">
      <BreakdownBar value={meterValue} level={currentLevel} round={currentRound} />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div className="stage-layout">
        <PhaserCanvas onPerform={handlePerform} disabled={isLoading} />
        <DanmakuStream list={danmakuList} />
      </div>
      <AICommentCard />
    </div>
  );
}
```

---

## 六、技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 + Vite + TypeScript | CodeBuddy 原生支持 |
| 状态管理 | Zustand | Simulation 与 Rendering 分层 |
| 游戏引擎 | Phaser.js 3 | 场景画布、物理碰撞、拖拽 |
| Phaser 通信 | EventBus 模式 | React ↔ Phaser 生命周期解耦 |
| 样式 | Tailwind CSS 3.4 + CSS 变量主题 | 直播间 UI + 移动端适配 |
| 后端 | 腾讯云 SCF (Node.js 18) | 提示词保护 + AI 代理 |
| 部署 | CloudStudio / EdgeOne Pages | 比赛指定 |
| AI 接入 | OpenAI 兼容接口 | 本地开发直连；生产演示走云函数代理 |
| 流式传输 | fetch + ReadableStream (POST) | `reaction_delta` 真流式优先；不支持则逐字降级 |
| 持久化 | localStorage + IndexedDB | 存档系统 |

---

## 七、调用时序（v3: fetch + ReadableStream POST，单端点）

```
时间线 →

Browser (fetch POST)         SCF                         AI API
  │                           │                            │
  │── POST /perform ────────→│                            │
  │   JSON body:              │                            │
  │   {observation,lv,model}  │                            │
  │                           │── POST /chat ────────────→│
  │                           │   stream:true              │
  │                           │   系统提示词(难度人格)       │
  │                           │                            │
  │                           │←── SSE token 1 ──────────│  ~800ms 首token
  │←── ReadableStream chunk ─│                            │
  │    reaction_delta: "哈"   │                            │
  │←── ReadableStream chunk ─│←── SSE token 2 ──────────│
  │←── ReadableStream chunk ─│←── SSE token 3 ──────────│
  │  ...弹幕逐字渲染...        │  ...                      │
  │←── reaction_done ────────│←── SSE [DONE] ──────────│
  │                           │                            │
  │                           │── POST /chat ────────────→│  第2次调用
  │                           │   stream:false             │
  │                           │   裁判提示词+难度校准系数    │
  │                           │←── JSON ─────────────────│  ~300ms
  │                           │   {"funny_score":7,...}    │
  │                           │                            │
  │←── score ────────────────│                            │  单次请求完成
  │    {funnyScore, reason}   │                            │
```

**关键改进（对比 v2.0）**：
- 传输方式从 EventSource GET → fetch POST（API Key 在 body + TLS，不在 URL 中）
- 浏览器从 2 次 HTTP 请求 → 1 次（单端点返回完整数据）
- 首 token 渲染 ~1秒，裁判评分 ~300ms，总感知延迟 2-3 秒不变

---

## 八、容错设计

| 异常场景 | 处理策略 |
|---------|---------|
| API Key 为空 | 前端拦截，提示填写 |
| AI API 超时 (15s) | 显示 "AI 正在思考中…"，超时提示重试 |
| 裁判 JSON 解析失败 | fallback: `{funny_score:5, reason:"裁判打了个盹"}` |
| SSE 断连 | 自动重连最多3次，失败回退非流式 |
| 绷不住值溢出 | `Math.min(100, value)` 硬上限 |
| 同一 API Key 并发限制 | 前端队列化请求，串行发送 |
| 用户双击"开始表演" | `AbortController` + `isLoading` 双重拦截（审查建议 #10） |
| ReadableStream 中断 | AbortError 静默处理，恢复 editing 状态 |
| localStorage 满 | 降级 IndexedDB，失败时仅丢失存档不影响游戏 |
| Phaser Game 初始化失败 | 错误边界显示"场景加载失败"，提供刷新按钮 |

---

## 九、前端模块划分

| 模块 | 职责 | 技术 |
|------|------|------|
| SceneLab | Phaser.js 场景画布 + 道具拖拽 + 触发器 + 物理系统 | Phaser 3 |
| PhaserEventBus | React ↔ Phaser 通信总线，事件驱动的生命周期解耦 | 自定义 EventBus |
| GameStore | 全局状态管理（Simulation 层），绷不住值、存档、回合 | Zustand |
| SaveSystem | 存档序列化/反序列化，localStorage/IndexedDB 适配 | TypeScript |
| LiveStage | 直播UI容器 + 回合控制 + 模式切换 + fetch POST | React |
| DanmakuStream | 弹幕滚动区，最近100条历史，overflow-y + 自动滚动 | React + CSS |
| BreakdownBar | 绷不住值渐变色进度条 + 动画 | React + Tailwind |
| AICommentCard | 裁判评语 + 得分展示 | React |
| ResultModal | 通关/失败结算 + 下一关/重试 | React |
| ThemeProvider | CSS 变量主题系统 + 响应式布局切换 | CSS + React Context |

---

## 十、开发时间线

| 序号 | 任务 | 验收标准 | 依赖 | 状态 |
|------|------|---------|------|------|
| 1 | React + Vite + TS 脚手架 | `npm run dev` 正常，ESLint+Prettier 配置完成 | 无 | 待执行 |
| 2 | 核心类型 + GameState + Zustand Store | GameState 可序列化/反序列化，单元测试通过 | 1 | 待执行 |
| 3 | Phaser Boot + Editor Scene | 画布加载，道具拖拽可用，生成 SceneSnapshot | 2 | 待执行 |
| 4 | Phaser EventBus + PropSystem + PhysicsSystem | 道具放置事件传递到 React，碰撞链正确计算 | 3 | 待执行 |
| 5 | prompts.js 5级难度提示词 + 裁判校准 | 每个难度输出符合预期人格，裁判稳定输出 JSON | 2 | 待执行 |
| 6 | 云函数 SCF (fetch+ReadableStream POST 代理) | 单端点返回 reaction + score + reason | 4, 5 | 待执行 |
| 7 | 直播演出 UI + 弹幕流 + 绷不住值 HUD + 存档 | 完整游戏循环可用，刷新页面不丢进度 | 4, 6 | 待执行 |
| 8 | 移动端适配 + CSS 主题系统 | 手机竖屏可完整操作，主题变量正确应用 | 7 | 待执行 |
| 9 | 5级难度调优 + 端到端测试 | 各难度差异化明显，无 JS 错误 | 6, 7 | 待执行 |
| 10 | 部署上线 + 社媒宣发 | CloudStudio 可访问链接，小红书/视频号发布 | 9 | 待执行 |

---

## 十一、腾讯云服务集成（加分项）

| 服务 | 用途 | 优先级 |
|------|------|--------|
| **CloudStudio** | 开发环境 + 部署在线链接 | 必须 |
| **腾讯云 SCF** | 云函数后端（系统提示词保护 + AI 转发） | 强烈推荐 |
| **CodeBuddy** | 开发工具（比赛必须，记得导出对话记录） | 必须 |
| **GVoice** | 给 AI 弹幕加实时语音朗读（提升沉浸感） | 可选加分 |
| **腾讯 MPS** | AI 生成背景音乐（直播间 BGM） | 可选加分 |

**CodeBuddy 使用技巧（评审会看对话记录）：**
- 用 CodeBuddy 生成 Phaser.js 场景逻辑和道具库
- 用 CodeBuddy 生成云函数代码（SCF 入口 + 提示词注入）
- 用 CodeBuddy 调试 AI 接口格式和 JSON 解析
- 用 CodeBuddy 迭代提示词（每个难度单独调优）
- **记得保存每次对话，提交时完整导出对话记录**

**GVoice 集成方案（可选）：**
- 拿到 AI 弹幕文本 → 调用 GVoice TTS → 返回音频 URL
- 前端在弹幕出现的同时播放语音，直播间沉浸感直接拉满
- 不同难度可以微调语音风格（LV1 活泼/ LV5 冷淡）

---

## 十二、Phaser 场景架构（解决审查建议 #4/#6/#7）

### 12.1 目录结构（遵循 phaser-2d-game skill 规范）

```
src/phaser/
├── scenes/
│   ├── BootScene.ts       # 预加载所有资源（Asset Manifest）
│   ├── MenuScene.ts       # 标题/模式选择（可选，可用 DOM 替代）
│   ├── EditorScene.ts     # 道具拖拽 + 物理放置 + 触发器配置
│   └── PreviewScene.ts    # 播放场景效果预览（可选）
├── systems/
│   ├── PropSystem.ts      # 道具数据管理 + 拖拽交互规则
│   ├── PhysicsSystem.ts   # 碰撞检测 + 触发事件链
│   └── Serialization.ts   # Phaser 场景 → SceneSnapshot 序列化
├── assets/
│   └── manifest.ts        # 道具纹理/texture 映射表
└── bridges/
    └── PhaserEventBus.ts  # Phaser ↔ React 通信总线
```

### 12.2 Asset Manifest（解决审查建议 #6）

```typescript
// src/phaser/assets/manifest.ts
export const PROP_MANIFEST = {
  banana:        { key: 'prop-banana',      path: '/props/banana.png',       size: [32, 32] },
  portal:        { key: 'prop-portal',       path: '/props/portal.png',       size: [64, 64] },
  trampoline:    { key: 'prop-trampoline',   path: '/props/trampoline.png',   size: [48, 32] },
  bomb:          { key: 'prop-bomb',         path: '/props/bomb.png',         size: [32, 32] },
  barrel:        { key: 'prop-barrel',       path: '/props/barrel.png',       size: [40, 48] },
  clumsyNpc:     { key: 'prop-npc',          path: '/props/npc.png',          size: [32, 48] },
  coffeeCup:     { key: 'prop-coffee',       path: '/props/coffee.png',       size: [16, 20] },
  springGlove:   { key: 'prop-spring',       path: '/props/spring.png',       size: [32, 32] },
  // ... 共 20 个道具
} as const;

export type PropKey = keyof typeof PROP_MANIFEST;
```

### 12.3 BootScene（统一预加载）

```typescript
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // 根据 manifest 统一加载所有道具纹理
    Object.values(PROP_MANIFEST).forEach(prop => {
      this.load.image(prop.key, prop.path);
    });
    // 加载 UI 资源
    this.load.image('grid-bg', '/ui/grid.png');
    this.load.image('btn-perform', '/ui/btn-perform.png');
  }

  create() {
    this.scene.start('EditorScene');
  }
}
```

### 12.4 React ↔ Phaser EventBus 集成模式（解决审查建议 #7）

```typescript
// src/phaser/bridges/PhaserEventBus.ts
// 轻量级事件总线，解耦 React 和 Phaser 的生命周期

type EventBusEvent =
  | { type: 'prop-placed'; prop: PlacedProp }
  | { type: 'prop-removed'; propId: string }
  | { type: 'perform-requested'; snapshot: SceneSnapshot }
  | { type: 'scene-ready' }
  | { type: 'scene-error'; error: Error };

class PhaserEventBus {
  private listeners = new Map<string, Set<Function>>();

  on(event: string, fn: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  emit(event: string, data?: unknown) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }
}

export const eventBus = new PhaserEventBus();

// React 组件中使用
function PhaserCanvas({ onPerform }: { onPerform: (snap: SceneSnapshot) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const game = new Phaser.Game({
      parent: containerRef.current!,
      width: 640,
      height: 480,
      backgroundColor: '#0a0a0f',
      scale: {                        // 移动端自适应（审查建议 #8）
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [BootScene, EditorScene],
    });

    // 通过 EventBus 解耦，不直接在 React 中操作 Phaser
    const unsub1 = eventBus.on('prop-placed', handlePropPlaced);
    const unsub2 = eventBus.on('perform-requested', (snap: SceneSnapshot) => {
      onPerform(snap);
    });

    return () => {
      unsub1();
      unsub2();
      game.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="phaser-container" />;
}
```

### 12.5 EditorScene 核心流程

```
BootScene (预加载)
    │
    ▼
EditorScene
    │
    ├── create()
    │   ├── 渲染网格背景
    │   ├── 初始化 PropSystem（道具面板）
    │   ├── 初始化 PhysicsSystem（碰撞组）
    │   └── 通过 EventBus 发送 scene-ready
    │
    ├── 拖拽道具
    │   ├── pointerdown → 创建可拖拽 sprite
    │   ├── pointermove → 跟随鼠标/触摸
    │   ├── pointerup   → 放置 + 触发 PhysicsSystem 计算
    │   └── 发射 prop-placed 事件到 React
    │
    └── 点击"开始表演"
        ├── Serialization.toSnapshot() → SceneSnapshot
        └── 发射 perform-requested 事件到 React
```

---

## 十三、TypeScript 类型体系（解决审查建议 #17）

项目所有核心模块均使用 TypeScript 严格模式，以下为顶层类型定义：

```typescript
// src/types/index.ts

// ============ 道具 & 场景 ============
export interface PlacedProp {
  id: string;
  type: PropKey;              // 来自 Asset Manifest
  x: number;
  y: number;
  rotation: number;
  actor?: string;             // 关联的角色名
  positionDesc?: string;      // 自然语言位置描述
  triggers: TriggerConfig[];
}

export interface TriggerConfig {
  type: 'collision' | 'click' | 'timer';
  targetId?: string;          // 碰撞目标道具 ID
  delay?: number;             // 定时器延迟(ms)
  conditions?: string[];      // 触发条件
}

export interface EventStep {
  type: 'collision' | 'trigger' | 'reaction';
  subject: string;
  target: string;
  result: string;
}

export interface EventChain {
  id: string;
  steps: EventStep[];
}

export interface SceneSnapshot {
  props: PlacedProp[];
  connections: EventChain[];
  timestamp: number;
}

// ============ 游戏状态 ============
export type ActionType =
  | 'prop:single'
  | 'prop:combo'
  | 'chain:reaction'
  | 'prop:mixed';             // 替代旧的 'meta:surprise'（审查建议 #11）

export interface RoundRecord {
  funnyScore: number;
  actualGain: number;
  actionType: ActionType;
  decayFactor: number;
  reaction: string;
  reason: string;
}

export interface RoundResult {
  reaction: string;
  funnyScore: number;
  reason: string;
  actualGain: number;
  decayFactor: number;
  props: PlacedProp[];
  chains: EventChain[];
}

// ============ 存档 ============
export interface SaveData {
  version: number;
  storyProgress: {
    unlockedLevels: number;
    bestScores: Record<number, number>;
  };
  endlessBest: {
    highScore: number;
    bestLevel: number;
  };
  settings: {
    apiKeyHint: string;       // 仅存后4位
  };
  savedAt: number;
}

// ============ API 通讯 ============
export interface PerformRequest {
  observation: ObservationPacket; // 运动关系观察包（前端生成）
  level: number;              // 1-5
  apiKey?: string;            // 可选；生产演示可由 SCF 环境变量提供
  baseUrl?: string;           // OpenAI 兼容 API Base URL
  model?: string;             // 模型 ID
}

export interface PerformResponse {
  reaction: string;           // AI 观众完整回复
  funnyScore: number;         // 0-10
  reason: string;             // 裁判归因
}

// ============ 难度配置 ============
export interface DifficultyConfig {
  level: number;
  name: string;               // "快乐小狗"
  baselineCoefficient: number; // 裁判校准系数
  targetAvgScore: number;     // 故事模式通关线
  maxRounds: number;
}
```

---

## 附录：prompts.js 结构索引

```
prompts.js
├── OUTPUT_RULES           (LV1-LV4 共用，不超过50字)
├── OUTPUT_RULES_LV5       (LV5 专用，不超过10字)
├── audience
│   ├── lv1: 快乐小狗  — 阿乐，21岁，什么都笑
│   ├── lv2: 好奇大学生 — 小七，22岁，B站六级，懂梗
│   ├── lv3: 淡定上班族 — 老陈，34岁，潜水观众
│   ├── lv4: 文艺鉴赏家 — 林老师，41岁，戏剧评论人
│   └── lv5: 冷面裁判官 — 零号评审，终极挑战
└── judge: 幽默反应分析系统
    ├── 评分锚点（0-10分段定义）
    ├── 难度校准系数表（LV1-LV5 的基线权重）
    ├── 强制 JSON 输出格式
    └── 违规自检清单
```

每条提示词均包含：角色设定 → 性格 → 笑点偏好(正向) → 免疫区(负向) → 语言风格 → 分层输出规则约束。
