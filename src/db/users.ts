import { seedDefaultAgents } from "./agents/seed";
import { getDb } from "./connection";
import {
  DEFAULT_RUN_AGENT_KEY,
  LEGACY_USER_DATA_CLAIMED_BY_KEY,
} from "./constants";

export function ensureUserData(ownerUuid: string): void {
  const db = getDb();
  const tx = db.transaction(() => {
    const legacyOwner = db
      .query("SELECT value FROM app_settings WHERE key = ?")
      .get(LEGACY_USER_DATA_CLAIMED_BY_KEY) as { value: string } | null;
    const hasLegacyData =
      db
        .query("SELECT 1 FROM sessions WHERE owner_uuid IS NULL LIMIT 1")
        .get() != null ||
      db.query("SELECT 1 FROM agents WHERE owner_uuid IS NULL LIMIT 1").get() !=
        null;

    if (!legacyOwner && hasLegacyData) {
      db.run("UPDATE sessions SET owner_uuid = ? WHERE owner_uuid IS NULL", [
        ownerUuid,
      ]);
      db.run("UPDATE agents SET owner_uuid = ? WHERE owner_uuid IS NULL", [
        ownerUuid,
      ]);
      db.run("INSERT INTO app_settings (key, value) VALUES (?, ?)", [
        LEGACY_USER_DATA_CLAIMED_BY_KEY,
        ownerUuid,
      ]);

      const legacyDefault = db
        .query("SELECT value FROM app_settings WHERE key = ?")
        .get(DEFAULT_RUN_AGENT_KEY) as { value: string } | null;
      if (legacyDefault?.value.trim()) {
        db.run(
          "INSERT OR IGNORE INTO user_settings (owner_uuid, key, value) VALUES (?, ?, ?)",
          [ownerUuid, DEFAULT_RUN_AGENT_KEY, legacyDefault.value.trim()],
        );
      }
    }

    seedDefaultAgents(db, ownerUuid);
    db.run(
      "INSERT OR IGNORE INTO user_settings (owner_uuid, key, value) VALUES (?, ?, ?)",
      [ownerUuid, DEFAULT_RUN_AGENT_KEY, "general_agent"],
    );
  });
  tx();
}
