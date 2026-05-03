import { runAgent } from "./agent.js";
import { PM_SYSTEM } from "./prompts.js";

export interface PMTask {
  title: string;
  intent: string;
}

export async function defineTask(userRequirement: string): Promise<PMTask> {
  const { text } = await runAgent(PM_SYSTEM, userRequirement);

  if (text.includes("NOT_CODE_TASK")) {
    throw new Error("Not a coding task");
  }

  try {
    const json = JSON.parse(extractJSON(text));
    return { title: json.title, intent: json.intent };
  } catch {
    return { title: "用户任务", intent: text.slice(0, 200) };
  }
}

export async function summarizeTask(fullTrace: string): Promise<string> {
  const { text } = await runAgent(
    PM_SYSTEM,
    `汇总以下任务的所有 subtask 结果:\n\n${fullTrace.slice(-8000)}`,
  );

  try {
    const json = JSON.parse(extractJSON(text));
    return json.summary || text;
  } catch {
    return text;
  }
}

function extractJSON(raw: string): string {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  return braceMatch ? braceMatch[0] : raw;
}
