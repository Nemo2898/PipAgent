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
  subtaskId: string,
  devResult: string,
): Promise<TLReview> {
  const input = `当前 subtask: ${subtaskId}\nDev 的结果:\n${devResult.slice(0, 2000)}\n\n验收这个结果。pass 还是 fail？`;
  const { text } = await runAgent(TL_SYSTEM, input);

  try {
    return JSON.parse(extractJSON(text));
  } catch {
    if (text.toLowerCase().includes("pass") || devResult.startsWith("[done]"))
      return { pass: true, next: subtaskId };
    return { pass: false, reason: text.slice(0, 200), retry: subtaskId };
  }
}

function extractJSON(raw: string): string {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  return braceMatch ? braceMatch[0] : raw;
}
