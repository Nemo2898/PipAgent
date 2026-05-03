import { runAgent } from "./agent.js";
import { TL_SYSTEM } from "./prompts.js";

export interface Subtask {
  id: string;
  title: string;
  goal: string;
  approach: string;
  outcome: string;
  key_points?: string;
}

export interface TLDecompose {
  subtasks: Subtask[];
}

export interface TLReview {
  pass: boolean;
  reason?: string;
  retry?: string;
  next?: string;
}

export async function decomposeTask(
  pmTitle: string,
  pmIntent: string,
): Promise<TLDecompose> {
  const input = `任务标题: ${pmTitle}\n意图: ${pmIntent}\n\n拆解这个任务为可执行的 subtask。`;
  const { text } = await runAgent(TL_SYSTEM, input);

  try {
    return JSON.parse(extractJSON(text));
  } catch {
    return {
      subtasks: [
        {
          id: "st-1",
          title: pmTitle,
          goal: pmIntent,
          approach: "由 Dev 自行决定",
          outcome: pmIntent,
        },
      ],
    };
  }
}

export async function reviewSubtask(
  subtask: Subtask,
  devResult: string,
  toolCalls: { name: string; args: Record<string, unknown>; result: string }[],
  workDir: string,
): Promise<TLReview> {
  const toolSummary =
    toolCalls.length > 0
      ? `\n\nDev 的工具调用:\n${toolCalls
          .map(
            (t) =>
              `  ${t.name}(${JSON.stringify(t.args).slice(0, 80)}) → ${t.result.slice(0, 120)}`,
          )
          .join("\n")}`
      : "";

  const input = [
    `当前 subtask: ${subtask.id}`,
    `目标: ${subtask.goal}`,
    `方法: ${subtask.approach}`,
    `效果: ${subtask.outcome}`,
    ``,
    `Dev 的结果:`,
    devResult.slice(0, 2000),
    toolSummary,
    ``,
    `工作目录: ${workDir}`,
    `你可以用 read_file 读取代码文件，用 bash ls 查看目录。`,
    ``,
    `对照 outcome 验收这个结果。pass 还是 fail？`,
  ].join("\n");

  const { text } = await runAgent(TL_SYSTEM, input, {
    enableTools: true,
    workDir,
  });

  try {
    return JSON.parse(extractJSON(text));
  } catch {
    if (text.toLowerCase().includes("pass") || devResult.startsWith("[done]"))
      return { pass: true, next: subtask.id };
    return { pass: false, reason: text.slice(0, 200), retry: subtask.id };
  }
}

function extractJSON(raw: string): string {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  return braceMatch ? braceMatch[0] : raw;
}
