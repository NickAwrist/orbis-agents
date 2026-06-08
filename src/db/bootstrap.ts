import type { Database } from "bun:sqlite";
import { DEFAULT_RUN_AGENT_KEY } from "./constants";

export function ensureDefaultRunAgentSetting(db: Database) {
  db.run("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)", [
    DEFAULT_RUN_AGENT_KEY,
    "general_agent",
  ]);
}
