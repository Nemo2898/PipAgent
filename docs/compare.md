# PipAgent TL Subtask 格式：固定字段 vs 动态键值

## 背景

当前 TL 产出 subtask 的格式为 `{id, title, description}`。为了提升拆解质量，
计划改为 `{id, title, goal, approach, outcome, key_points?}`。
这涉及一个设计选择：管线代码是否应该对字段名做硬编码。

---

## 方案 A：固定字段

### 实现

```typescript
// tl.ts — 类型定义
interface Subtask {
  id: string;
  title: string;
  goal: string;
  approach: string;
  outcome: string;
  key_points?: string;
}

// dev.ts — 硬编码组装
const input = [
  `目标: ${subtask.goal}`,
  `方法: ${subtask.approach}`,
  `效果: ${subtask.outcome}`,
  subtask.key_points ? `要点: ${subtask.key_points}` : "",
].join("\n\n");

// flow.ts — PipeTrace 记录
const record = `${st.id}: ${st.title} — ${st.goal} | ${st.approach} → ${st.outcome}`;
```

### 评估

| 维度 | 评价 |
|---|---|
| 类型安全 | ✓ TypeScript 编译时报错 |
| Dev 收到的文本 | ✓ 中文标签，可读性好 |
| TL 产物验证 | ✓ parse 时可检查必填字段 |
| 改动成本 | ✗ 改 TL prompt → 需同步改 4 个文件 |
| 适用场景 | TL prompt 稳定或偶尔改动 |

---

## 方案 B：动态键值

### 实现

```typescript
// tl.ts — 通用类型
type Subtask = { id: string; title: string; [key: string]: string };

// dev.ts — 遍历所有字段
const input = Object.entries(subtask)
  .filter(([k]) => k !== "id")
  .map(([k, v]) => `**${k}**: ${v}`)
  .join("\n\n");

// flow.ts — PipeTrace 记录
const record = `${st.id}: ${st.title}\n${Object.entries(st).filter(([k]) => k !== "id").map(([k,v]) => `  ${k}: ${v}`).join("\n")}`;
```

### 评估

| 维度 | 评价 |
|---|---|
| 改动成本 | ✓ 改 TL prompt 只改 prompts.ts |
| 扩展性 | ✓ 加字段零代码改动 |
| 类型安全 | ✗ 字段名无编译检查 |
| Dev 收到的文本 | ✗ `**goal**: ...` 格式生硬 |
| TL 产物验证 | ✗ 无法在代码中检查必填字段 |
| 适用场景 | TL prompt 频繁迭代或字段不确定 |

---

## 建议

PipAgent v3.2 阶段选方案 A。

理由：
- TL prompt 处于稳定阶段，一年内不会频繁改动
- 类型安全 + 必填验证在当前阶段比扩展性更值钱
- QnA 量级的项目（~250 行），过早抽象是成本而非收益

当 TL prompt 实际改动超过 2 次时，再重构到方案 B。到时改动量约 15 行。
