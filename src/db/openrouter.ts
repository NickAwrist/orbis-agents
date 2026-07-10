import type { Database } from "bun:sqlite";
import { getDb } from "./connection";
import {
  LEGACY_OPENROUTER_MODELS_SEEDED_KEYS,
  OPENROUTER_MODELS_SEEDED_KEY,
} from "./constants";
import type { OpenRouterModel } from "./types";

export const DEFAULT_OPENROUTER_MODELS = [
  {
    name: "GPT-5.6 Terra",
    route: "openai/gpt-5.6-terra",
    ai_lab: "OpenAI",
  },
  {
    name: "GPT-5.6 Luna",
    route: "openai/gpt-5.6-luna",
    ai_lab: "OpenAI",
  },
  {
    name: "Claude Opus 4.8",
    route: "anthropic/claude-opus-4.8",
    ai_lab: "Anthropic",
  },
  {
    name: "Claude Sonnet 5",
    route: "anthropic/claude-sonnet-5",
    ai_lab: "Anthropic",
  },
  {
    name: "Claude Fable 5",
    route: "anthropic/claude-fable-5",
    ai_lab: "Anthropic",
  },
  {
    name: "Gemini 3.5 Flash",
    route: "google/gemini-3.5-flash",
    ai_lab: "Google",
  },
  {
    name: "Gemini 3.1 Pro Preview",
    route: "google/gemini-3.1-pro-preview",
    ai_lab: "Google",
  },
];

const LEGACY_DEFAULT_OPENROUTER_ROUTES = [
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-sonnet-4.6",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/gpt-5.4-mini",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "google/gemini-3.5-flash",
  "google/gemini-3.1-pro-preview",
];

/**
 * Inserts the starter registry exactly once. A marker keeps deleted defaults
 * from reappearing on later app starts.
 */
export function seedDefaultOpenRouterModels(db: Database): void {
  const seeded = db
    .query("SELECT value FROM app_settings WHERE key = ?")
    .get(OPENROUTER_MODELS_SEEDED_KEY) as { value: string } | null;
  if (seeded) return;

  const legacySeeded = db
    .query("SELECT value FROM app_settings WHERE key = ?")
    .get(LEGACY_OPENROUTER_MODELS_SEEDED_KEYS[0]) as { value: string } | null;
  const legacySeededV2 = db
    .query("SELECT value FROM app_settings WHERE key = ?")
    .get(LEGACY_OPENROUTER_MODELS_SEEDED_KEYS[1]) as { value: string } | null;

  const insert = db.prepare(
    "INSERT OR IGNORE INTO openrouter_models (name, route, ai_lab) VALUES (?, ?, ?)",
  );

  const tx = db.transaction(() => {
    if (legacySeeded || legacySeededV2) {
      const removeLegacyDefaults = db.prepare(
        "DELETE FROM openrouter_models WHERE route = ?",
      );
      for (const route of LEGACY_DEFAULT_OPENROUTER_ROUTES) {
        removeLegacyDefaults.run(route);
      }
    }
    for (const model of DEFAULT_OPENROUTER_MODELS) {
      insert.run(model.name, model.route, model.ai_lab);
    }
    db.run("INSERT INTO app_settings (key, value) VALUES (?, '1')", [
      OPENROUTER_MODELS_SEEDED_KEY,
    ]);
  });
  tx();
}

/**
 * Returns all registered OpenRouter models sorted by name.
 */
export function listOpenRouterModels(): OpenRouterModel[] {
  return getDb()
    .query(
      "SELECT id, name, route, ai_lab FROM openrouter_models ORDER BY name ASC",
    )
    .all() as OpenRouterModel[];
}

export function getOpenRouterModelByRoute(
  route: string,
): OpenRouterModel | null {
  const row = getDb()
    .query(
      "SELECT id, name, route, ai_lab FROM openrouter_models WHERE route = ?",
    )
    .get(route.trim()) as OpenRouterModel | null;
  return row ?? null;
}

/**
 * Registers a new OpenRouter model.
 */
export function createOpenRouterModel(model: {
  name: string;
  route: string;
  ai_lab: string;
}): OpenRouterModel {
  const db = getDb();
  const result = db
    .query(
      "INSERT INTO openrouter_models (name, route, ai_lab) VALUES (?, ?, ?) RETURNING id, name, route, ai_lab",
    )
    .get(
      model.name.trim(),
      model.route.trim(),
      model.ai_lab.trim(),
    ) as OpenRouterModel;
  return result;
}

/**
 * Deletes an OpenRouter model by ID.
 */
export function deleteOpenRouterModel(id: number): boolean {
  const db = getDb();
  const info = db.prepare("DELETE FROM openrouter_models WHERE id = ?").run(id);
  return info.changes > 0;
}
