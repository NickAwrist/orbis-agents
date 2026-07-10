import { getOpenRouterModelByRoute } from "../db/index";
import type { ResolvedModel } from "./types";

export const OPENROUTER_MODEL_PREFIX = "openrouter:";

export function openRouterModelId(route: string): string {
  return `${OPENROUTER_MODEL_PREFIX}${route}`;
}

export function resolveModelSelection(selection: string): ResolvedModel {
  const trimmed = selection.trim();
  if (trimmed.startsWith(OPENROUTER_MODEL_PREFIX)) {
    return {
      provider: "openrouter",
      model: trimmed.slice(OPENROUTER_MODEL_PREFIX.length),
    };
  }

  // Accept the raw route for compatibility with early OpenRouter builds.
  if (getOpenRouterModelByRoute(trimmed)) {
    return { provider: "openrouter", model: trimmed };
  }

  return { provider: "ollama", model: trimmed };
}
