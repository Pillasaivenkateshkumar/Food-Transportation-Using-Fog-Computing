import fs from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./project-root.mjs";

let cachedConfig;

export async function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(projectRoot, "config", "edgeguard.config.json");
  const content = await fs.readFile(configPath, "utf8");
  cachedConfig = JSON.parse(content);
  return cachedConfig;
}
