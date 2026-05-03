import { createHash } from "crypto";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { resolve } from "path";
import { defineTask, summarizeTask } from "./pm.js";
import { decomposeTask, reviewSubtask } from "./tl.js";
import { executeSubtask } from "./dev.js";
import { createTask, readTask, appendBlock } from "./trace.js";
import type { Subtask } from "./tl.js";

export interface TaskResult {
  hash: string;
  title: string;
  intent: string;
  subtasks: { id: string; title: string; done: boolean; reason?: string }[];
  summary: string;
  retries: number;
}

export async function runTask(requirement: string): Promise<TaskResult> {
  // 生成 hash
  const hash = createHash("sha256").update(requirement).digest("hex").slice(0, 8);

  // 工作目录 
  const workDir = resolve(process.cwd(), "test_project");
  if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

  // ── PM: 定义任务 ──
  console.log("\n[PM] 分析需求...");
  const pmTask = await defineTask(requirement);
  createTask(hash, pmTask.title, pmTask.intent);
  console.log(`  任务: ${pmTask.title}`);

  // ── TL: 拆解 ──
  console.log("\n[TL] 拆解 subtask...");
  const tlResult = await decomposeTask(pmTask.title, pmTask.intent);
  const subtasks = tlResult.subtasks;
  appendBlock(
    hash,
    pmTask.title,
    "TL — 任务拆解",
    subtasks.map((s: Subtask) => `${s.id}: ${s.title}`).join("\n"),
  );
  console.log(`  拆为 ${subtasks.length} 个 subtask:`);
  for (const s of subtasks) console.log(`    ${s.id}: ${s.title}`);

  // ── Dev → TL 迭代循环 ──
  const results: { id: string; title: string; done: boolean; reason?: string }[] = [];
  let retries = 0;

  for (const subtask of subtasks) {
    let attempt = 0;
    while (true) {
      attempt++;
      console.log(`\n[Dev] 执行 ${subtask.id} (第 ${attempt} 次)...`);
      const devResult = await executeSubtask(subtask, workDir);
      const isDone = devResult.startsWith("[done]");
      console.log(`  ${isDone ? "✓" : "✗"} ${devResult.slice(0, 120)}`);

      appendBlock(hash, pmTask.title, `Dev — ${subtask.id}`, devResult);

      // TL 验收
      console.log(`\n[TL] 验收 ${subtask.id}...`);
      const review = await reviewSubtask(subtask.id, devResult);

      if (review.pass) {
        appendBlock(
          hash,
          pmTask.title,
          "TL — 验收",
          `${subtask.id} pass ✓`,
        );
        console.log(`  ${subtask.id} pass ✓`);
        results.push({ id: subtask.id, title: subtask.title, done: true });
        break;
      }

      retries++;
      appendBlock(
        hash,
        pmTask.title,
        "TL — 验收",
        `${subtask.id} fail ✗ — ${review.reason || "原因未说明"}`,
      );
      console.log(
        `  ${subtask.id} fail ✗ — ${review.reason?.slice(0, 80) || "打回重做"}`,
      );

      if (attempt >= 3) {
        results.push({
          id: subtask.id,
          title: subtask.title,
          done: false,
          reason: `3 次尝试后放弃: ${review.reason || ""}`,
        });
        break;
      }
    }
  }

  // ── PM: 汇总 ──
  console.log("\n[PM] 汇总结果...");
  const trace = readTask(hash, pmTask.title);
  const summary = await summarizeTask(trace);
  appendBlock(hash, pmTask.title, "PM — 汇总", summary);
  console.log(`  ${summary.slice(0, 200)}`);

  const doneCount = results.filter((r) => r.done).length;
  console.log(
    `\n═══════════════════════════════`,
  );
  console.log(
    `任务完成: ${doneCount}/${subtasks.length} subtask / ${retries} 次打回`,
  );
  console.log(`PipeTrace: traces/${hash}-*.md`);

  return {
    hash,
    title: pmTask.title,
    intent: pmTask.intent,
    subtasks: results,
    summary,
    retries,
  };
}
