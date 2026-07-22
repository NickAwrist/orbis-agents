import type { Database } from "bun:sqlite";

export function migrateSessionsAgentColumn(db: Database) {
  const cols = db.query("PRAGMA table_info(sessions)").all() as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === "agent_name")) {
    db.run("ALTER TABLE sessions ADD COLUMN agent_name TEXT");
  }
}

export function migrateSessionsDirectoryColumn(db: Database) {
  const cols = db.query("PRAGMA table_info(sessions)").all() as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === "session_directory")) {
    db.run("ALTER TABLE sessions ADD COLUMN session_directory TEXT");
  }
}

export function migrateSessionsOwnerColumn(db: Database) {
  const cols = db.query("PRAGMA table_info(sessions)").all() as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === "owner_uuid")) {
    db.run("ALTER TABLE sessions ADD COLUMN owner_uuid TEXT");
  }
}

export function migrateAgentsOwnerColumn(db: Database) {
  const cols = db.query("PRAGMA table_info(agents)").all() as {
    name: string;
  }[];
  if (cols.some((c) => c.name === "owner_uuid")) return;

  db.run("PRAGMA foreign_keys = OFF");
  try {
    const tx = db.transaction(() => {
      db.run(`
        CREATE TABLE agents_with_owners (
          id TEXT PRIMARY KEY,
          owner_uuid TEXT,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          system_prompt TEXT NOT NULL DEFAULT '',
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(owner_uuid, name)
        )
      `);
      db.run(`
        INSERT INTO agents_with_owners
          (id, owner_uuid, name, description, system_prompt, is_default, created_at, updated_at)
        SELECT id, NULL, name, description, system_prompt, is_default, created_at, updated_at
        FROM agents
      `);
      db.run("DROP TABLE agents");
      db.run("ALTER TABLE agents_with_owners RENAME TO agents");
    });
    tx();
  } finally {
    db.run("PRAGMA foreign_keys = ON");
  }
}

/**
 * One-shot migration from the old `include_personalization` / `include_session_directory` /
 * `include_os_info` flags to inline `{{PLACEHOLDER}}` tokens in `system_prompt`.
 */
export function migrateAgentsInlinePlaceholders(db: Database) {
  const cols = db.query("PRAGMA table_info(agents)").all() as {
    name: string;
  }[];
  const columnNames = new Set(cols.map((column) => column.name));
  const hasAny =
    columnNames.has("include_personalization") ||
    columnNames.has("include_session_directory") ||
    columnNames.has("include_os_info");
  if (!hasAny) return;

  const legacyFlag = (name: string) =>
    columnNames.has(name) ? name : `0 AS ${name}`;

  const rows = db
    .query(
      `SELECT id, system_prompt,
        ${legacyFlag("include_personalization")},
        ${legacyFlag("include_session_directory")},
        ${legacyFlag("include_os_info")}
      FROM agents`,
    )
    .all() as Array<{
    id: string;
    system_prompt: string;
    include_personalization: number | null;
    include_session_directory: number | null;
    include_os_info: number | null;
  }>;

  const update = db.prepare("UPDATE agents SET system_prompt = ? WHERE id = ?");
  const tx = db.transaction(() => {
    for (const r of rows) {
      const parts: string[] = [r.system_prompt ?? ""];
      const has = (tok: string) => parts[0]!.includes(tok);
      if (r.include_personalization && !has("{{PERSONALIZATION}}")) {
        parts.push("{{PERSONALIZATION}}");
      }
      if (r.include_session_directory && !has("{{SESSION_DIRECTORY}}")) {
        parts.push("{{SESSION_DIRECTORY}}");
      }
      if (r.include_os_info && !has("{{OS}}")) {
        parts.push("{{OS}}");
      }
      if (parts.length > 1) {
        update.run(parts.filter((s) => s.length > 0).join("\n\n"), r.id);
      }
    }
  });
  tx();

  if (columnNames.has("include_personalization")) {
    db.run("ALTER TABLE agents DROP COLUMN include_personalization");
  }
  if (columnNames.has("include_session_directory")) {
    db.run("ALTER TABLE agents DROP COLUMN include_session_directory");
  }
  if (columnNames.has("include_os_info")) {
    db.run("ALTER TABLE agents DROP COLUMN include_os_info");
  }
}

export function runMigrations(db: Database) {
  migrateSessionsAgentColumn(db);
  migrateSessionsDirectoryColumn(db);
  migrateAgentsInlinePlaceholders(db);
  migrateSessionsOwnerColumn(db);
  migrateAgentsOwnerColumn(db);
}
