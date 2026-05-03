-这是什么? 
-一个普通大二学生依赖ai迭代实现的agent架构 -最初的理念 其实很简单
-从省token 到管理上下文 到上下文管理驱动的注意力控制 
-最后大繁至简 收敛为多instance 不同agents之间的沟通机制 
-像处理和执行管线一样 处理agent的任务和思维流


# PipAgent v3.2

> 每个 session 都是一次纯函数调用。PipeTrace 是唯一共享状态。

---

## 设计哲学

两条原则，催生了整个框架：

```
原则 1：Session 切换提升 token 效费比
        每个角色独立上下文，从零开始

原则 2：Session 间有效通信
        PipeTrace 作为唯一共享状态，三条信道传递
```

问题 1 催生了 PipAgent。问题 2 催生了 PipeTrace。没有第三条。

---

## 一、核心模型：纯函数 + 共享文档

```
没有持久化 Agent。没有内存。没有上下文积累。

每个 Agent session = f(pipeTrace) → 写入 pipeTrace → 销毁

PM session   新建 → 读用户需求 → 写 PipeTrace → 销毁
TL session   新建 → 读 PipeTrace → 写分配 → 销毁
Dev session  新建 → 读 PipeTrace → 写 done/undone → 销毁
TL session   新建（又一个新 TL）→ 读 PipeTrace → 验收 → 销毁
PM session   新建 → 读 PipeTrace → 汇总 → 销毁
```

**PipeTrace 是唯一的状态源。Agent 之间零共享上下文。**

---

## 二、任务流转

```
┌─ PipeTrace 任务块 ────────────────────────────────┐
│                                                    │
│  PM 写入:  任务标题 + 浓缩的用户意图                 │
│  TL 写入:  拆解的 subtask 列表                      │
│                                                    │
│  迭代循环:                                          │
│    TL 分配 → Dev 执行                               │
│      Dev 写入: [done] 或 [undone + 原因]            │
│      TL 新建 → 读验收 → pass → 推进下一个            │
│                       → fail → Dev 再改             │
│                                                    │
│  最终 TL 不通过 → 继续打回                           │
│  最终 TL 通过   → 通知 PM                           │
│                                                    │
│  PM 汇总: 全部 subtask 结果 → 写入日志 → 任务完成     │
└────────────────────────────────────────────────────┘
```

**PM**：只进不出。定义任务，汇总结果。中间不参与迭代。

**TL**：循环中枢。拆 task、分配、验收。唯一有权让 Dev 重做。

**Dev**：纯执行。只做两件事：写 done 或写 undone + 原因。不规划、不评估、不决策。

---

## 三、PipeTrace 任务块结构

一个任务 = PipeTrace 里的一个文本块。

```
######################################################################
# HASH: a3f2c1d0
# 目标: 做一个 Flask RESTful API，支持注册/登录/JWT/个人信息
# PM 意图: 用户需要完整用户系统。JWT 认证，SQLite 存储。24h token 过期。
######################################################################

---
## TL — 任务拆解
st-1: 搭建项目基础结构 (准备 Flask + 依赖)
st-2: User 模型 + SQLite (SQLAlchemy model)
st-3: 注册接口 (POST /register)
st-4: 登录 + JWT (POST /login)
st-5: 个人信息 (GET /profile, JWT 保护)
st-6: 输入验证 + 错误处理
---

---
## Dev — st-1
[done] 项目基础结构完成。app.py + config.py + requirements.txt。
---

---
## Dev — st-2
[done] User 模型完成。id/username/password_hash/email。
---

---
## Dev — st-3
[done] POST /register 完成。校验 + 哈希 + 存储。
---

---
## Dev — st-4
[undone] login 返回 JWT。但 token 过期时间未设 24h。
原因: 忘记在 config 里加 JWT_ACCESS_TOKEN_EXPIRES。
---

---
## TL — 验收
st-1 pass. st-2 pass. st-3 pass.
st-4 fail — 缺 JWT 过期配置。打回 Dev。
---

---
## Dev — st-4 (第 2 次)
[done] 补上 timedelta(hours=24)。重新测试通过。
---

---
## TL — 最终验收
全部 6 个 subtask 通过。
---

---
## PM — 汇总
任务完成。6 subtask / 1 次打回。总 token 约 8.4K。
Flask 用户系统已就绪：注册、登录、JWT、个人信息、SQLite。
---
```

---

## 四、双重可追溯：PipeTrace + Git

每个任务块 = 一个 git 分支。共享相同的 hash 标签。

```
a3f2c1d0:add-jwt-auth              ← PipeTrace 任务块（思维流）
         ↕ 共享 hash
feature/a3f2c1d0-jwt-auth          ← git 分支（代码流）

Dev [done] st-1  → commit a1b2c3d
Dev [done] st-2  → commit d4e5f6g
Dev [undone]     → commit g7h8i9j （留下失败记录，可追溯）
Dev [done] st-4  → commit j0k1l2m
TL 最终验收 pass  → merge to main → 删除 feature 分支
```

**一个 hash，两条追溯线：**

```
cat traces/a3f2c1d0-*.md     → 看决策链：谁做了什么、为什么打回、几次迭代
git log feature/a3f2c1d0-*   → 看代码链：每次修改了什么、commit message 里对应哪个 subtask
```

**思维流可读、代码流可 git bisect。** 双重可追溯，互补。

---

## 五、Dev 的输出永远两选一

```
[done]   简要说明做了什么
[undone] 原因
```

**没有中间状态。没有"部分完成"。** Dev 对每个 subtask 只有两个结局。简洁使之可靠。

---

## 六、PM 和 TL 的角色

| | PM | TL |
|---|---|---|
| 写入 PipeTrace 的时机 | 开头（意图）+ 结尾（汇总） | 开头（拆解）+ 每次迭代（验收） |
| 是否参与迭代 | 否 | 是 |
| 看代码吗 | 不看 | 看 diff |
| 有权打回吗 | 否 | 是 |

---

## 七、架构对比

| v3.0 | v3.2 |
|---|---|
| 顺序管线（pm → tl → dev → qa → tl） | 迭代循环（tl → dev ↔ tl → pm） |
| Agent 模块有类型签名 | Agent 纯函数：读 PipeTrace → 写 PipeTrace |
| 管线由 YAML 定义 | 流转靠 PipeTrace + 角色约定 |
| QA 独立角色 | QA 并入 TL 验收环节 |
| 没有 PM 汇总 | PM 汇总作为任务关闭动作 |

---

## 八、和现有方案的区别

```
opencode        单 Agent 做所有事 → 上下文膨胀 → 注意力稀释
PipAgent v3.2   多个纯函数 session → PipeTrace 共享 → 上下文永远干净
```

不是"压缩"。不是"调度"。是**把 Agent 之间的通信从上下文搬运改为文档传递**。

---

## 九、技术栈

```
TypeScript (Node.js)
LLM API: OpenAI-compatible (raw fetch)
PipeTrace: 单文本文件 (append-only)
依赖: js-yaml, chalk (着色 CLI 输出)
```

---

## 十、行数估算

```
agent.ts      ← fetch + tool call loop     ~80 行
config.ts     ← YAML 解析                   ~30 行
pipeline.ts   ← 流转控制                    ~40 行
pipetrace.ts  ← 单文本读写                   ~30 行
pm.ts         ← PM prompt template          ~15 行
tl.ts         ← TL prompt template          ~15 行
dev.ts        ← Dev prompt template         ~15 行
cli.ts        ← 命令行入口                   ~20 行
─────────────────────────────────────────
总计约 250 行
```

---

## 十一、总结

PipAgent v3.2 不是一个 Agent 框架。是一个**文档驱动的无状态流转模型**。

- 没有持久 Agent → 每次 session 都是新建的纯函数
- 没有共享上下文 → Agent 之间只看 PipeTrace
- 没有压缩引擎 → 上下文本来就不需要压缩
- 没有调度器 → 流转靠 PipeTrace 的内容自己说
- Dev 只有 done/undone → 简单使之可靠
- 一个 hash = PipeTrace 任务块 + git 分支 → 思维流和代码流双重可追溯

**效果提升的源头不是算法优化，是信息隔离 + 纯函数式的无状态设计。**
