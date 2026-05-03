import {
  readFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { resolve, basename } from "path";
import { loadConfig } from "./config.js";

function traceDir(): string {
  const cfg = loadConfig();
  const dir = resolve(process.cwd(), cfg.trace_dir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function taskFile(hash: string, title: string): string {
  const slug = title.replace(/\s+/g, "-").slice(0, 40).toLowerCase();
  return resolve(traceDir(), `${hash}-${slug}.md`);
}

export function createTask(
  hash: string,
  title: string,
  intent: string,
): string {
  const block = [
    "#".repeat(70),
    `# HASH: ${hash}`,
    `# 目标: ${title}`,
    `# PM 意图: ${intent}`,
    "#".repeat(70),
    "",
  ].join("\n");
  const file = taskFile(hash, title);
  appendFileSync(file, block, "utf8");
  return file;
}

export function appendBlock(
  hash: string,
  title: string,
  agent: string,
  content: string,
): void {
  const file = taskFile(hash, title);
  const block = [
    "",
    "---",
    `## ${agent}`,
    content,
    "---",
    "",
  ].join("\n");
  appendFileSync(file, block, "utf8");
}

export function readTask(hash: string, title: string): string {
  const file = taskFile(hash, title);
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8");
}

export function findTaskByHash(hash: string): string | null {
  const dir = traceDir();
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir);
  const match = files.find((f) => f.startsWith(hash));
  if (!match) return null;
  return readFileSync(resolve(dir, match), "utf8");
}

export function listTasks(): string[] {
  const dir = traceDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md"));
}
