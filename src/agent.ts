import { loadConfig, getEnv } from "./config.js";

interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface Choice {
  message: {
    role: string;
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: string;
}

interface APIResponse {
  choices: Choice[];
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "读取文件内容",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "写入文件内容",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash",
      description: "执行 shell 命令",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
    },
  },
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const { readFileSync, writeFileSync, mkdirSync, existsSync } = await import(
    "fs"
  );
  const { dirname } = await import("path");
  const { execSync } = await import("child_process");

  switch (name) {
    case "read_file": {
      const p = args.path as string;
      if (!existsSync(p)) return `Error: file not found: ${p}`;
      return readFileSync(p, "utf8");
    }
    case "write_file": {
      const p = args.path as string;
      const c = args.content as string;
      const dir = dirname(p);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(p, c, "utf8");
      return `OK: wrote ${p} (${c.length} bytes)`;
    }
    case "bash": {
      try {
        const out = execSync(args.command as string, {
          encoding: "utf8",
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        });
        return out || "(no output)";
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; message: string };
        return `Error: ${err.stderr || err.message}`;
      }
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

export interface AgentResult {
  text: string;
  toolCalls: { name: string; args: Record<string, unknown>; result: string }[];
}

export async function runAgent(
  systemPrompt: string,
  userInput: string,
  options?: { enableTools?: boolean },
): Promise<AgentResult> {
  const cfg = loadConfig();
  const apiKey = getEnv("OPENAI_API_KEY", "");
  const baseUrl = cfg.base_url;
  const model = cfg.model;
  const enableTools = options?.enableTools ?? false;

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userInput },
  ];

  const toolCalls: AgentResult["toolCalls"] = [];
  const maxSteps = 20;

  for (let step = 0; step < maxSteps; step++) {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.3,
    };
    if (enableTools) body.tools = TOOLS;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API ${res.status}: ${err.slice(0, 300)}`);
    }

    const data = (await res.json()) as APIResponse;
    const choice = data.choices[0];
    const msg = choice.message;

    // Check for tool calls
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push({
        role: "assistant",
        tool_calls: msg.tool_calls,
        content: msg.content,
      });

      for (const tc of msg.tool_calls) {
        const args = JSON.parse(tc.function.arguments || "{}");
        const result = await executeTool(tc.function.name, args);
        toolCalls.push({
          name: tc.function.name,
          args,
          result,
        });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }
      continue;
    }

    // Final text response
    const text = msg.content || "";
    return { text, toolCalls };
  }

  throw new Error("Agent exceeded max tool steps");
}
