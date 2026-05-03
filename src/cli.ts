#!/usr/bin/env node
import { runTask } from "./flow.js";
import { listTasks, findTaskByHash } from "./trace.js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadDotEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const envText = readFileSync(envPath, "utf8");
    for (const line of envText.split("\n")) {
      if (line && !line.startsWith("#")) {
        const [k, ...v] = line.split("=");
        if (k) process.env[k.trim()] = v.join("=").trim();
      }
    }
  } catch {
    // .env optional
  }
}

async function main() {
  loadDotEnv();

  const cmd = process.argv[2];

  if (cmd === "run") {
    const requirement = process.argv.slice(3).join(" ");
    if (!requirement) {
      console.log("用法: pipagent run <需求描述>");
      process.exit(1);
    }
    try {
      await runTask(requirement);
    } catch (e) {
      console.error("错误:", (e as Error).message);
      process.exit(1);
    }
  } else if (cmd === "list") {
    const tasks = listTasks();
    if (tasks.length === 0) console.log("(无任务记录)");
    for (const t of tasks) console.log(t);
  } else if (cmd === "show") {
    const hash = process.argv[3];
    if (!hash) {
      console.log("用法: pipagent show <hash>");
      process.exit(1);
    }
    const content = findTaskByHash(hash);
    if (content) {
      console.log(content);
    } else {
      console.log(`未找到 hash: ${hash}`);
    }
  } else {
    console.log("PipAgent v0.1");
    console.log("  pipagent run <需求>     执行任务");
    console.log("  pipagent list           列出所有任务");
    console.log("  pipagent show <hash>    查看任务详情");
  }
}

main();
