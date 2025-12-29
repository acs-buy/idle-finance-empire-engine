import defaultConfig from "../../../config/game.config.json";
import type { GameConfig } from "./types";
import { validateGameConfig } from "./validate";

const validatedConfig = validateGameConfig(
  defaultConfig as GameConfig,
  defaultConfig as GameConfig,
);

export function getClientConfig(): GameConfig {
  if (typeof window !== "undefined") {
    const injected = (window as typeof window & {
      __GAME_CONFIG__?: unknown;
    }).__GAME_CONFIG__;
    if (injected) {
      return validateGameConfig(injected, validatedConfig);
    }
  }
  return validatedConfig;
}
