import { readFileSync } from "fs";
import { resolve } from "path";
import { load } from "js-yaml";

export interface Config {
  model: string;
  base_url: string;
  trace_dir: string;
}

let _config: Config | null = null;

export function loadConfig(path?: string): Config {
  if (_config) return _config;
  const p = path || resolve(process.cwd(), "pipagent.yaml");
  const raw = readFileSync(p, "utf8");
  _config = load(raw) as Config;
  return _config;
}

export function getEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}
