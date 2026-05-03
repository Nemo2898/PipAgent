import { runAgent } from "./agent.js";
import { DEV_SYSTEM } from "./prompts.js";

export async function executeSubtask(
  subtask: { id: string; title: string; description: string },
): Promise<string> {
  const input = [
    `当前 subtask: ${subtask.id}`,
    `标题: ${subtask.title}`,
    `描述: ${subtask.description}`,
    "",
    "输出 [done] 或 [undone]。不要其他格式。",
  ].join("\n");

  const { text, toolCalls } = await runAgent(DEV_SYSTEM, input, {
    enableTools: true,
  });

  return text.trim();
}
