import fs from "fs";
import path from "path";
import defaultConfig from "../../../config/game.config.json";
import type { GameConfig } from "./types";
import { validateGameConfig } from "./validate";

function readConfigFile(configPath: string): unknown | null {
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function loadServerConfig(): GameConfig {
  const defaultValidated = validateGameConfig(
    defaultConfig as GameConfig,
    defaultConfig as GameConfig,
  );
  const configPath =
    process.env.GAME_CONFIG_PATH ??
    path.join(process.cwd(), "config", "game.config.json");
  const parsed = readConfigFile(configPath);
  if (!parsed) return defaultValidated;
  return validateGameConfig(parsed, defaultValidated);
}
