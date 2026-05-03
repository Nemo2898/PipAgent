import { runAgent } from "./agent.js";
import { DEV_SYSTEM } from "./prompts.js";
import { existsSync, readdirSync } from "fs";

export async function executeSubtask(
  subtask: { id: string; title: string; description: string },
  workDir: string,
): Promise<string> {
  const existingFiles = existsSync(workDir)
    ? readdirSync(workDir, { recursive: true })
        .map((f) => String(f))
        .filter((f) => !f.startsWith(".") && !f.startsWith("node_modules"))
        .slice(0, 20)
        .join(", ") || "(空目录)"
    : "(目录不存在)";

  const input = [
    `当前工作目录: ${workDir}`,
    `目录现有文件: ${existingFiles}`,
    "",
    `当前 subtask: ${subtask.id}`,
    `标题: ${subtask.title}`,
    `描述: ${subtask.description}`,
    "",
    "输出 [done] 或 [undone]。不要其他格式。",
  ].join("\n");

  const { text } = await runAgent(DEV_SYSTEM, input, {
    enableTools: true,
    workDir,
  });

  return text.trim();
}
