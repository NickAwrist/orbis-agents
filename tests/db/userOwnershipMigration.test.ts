import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { runMigrations } from "../../src/db/migrations";

test("ownership migration preserves legacy sessions, agents, and tools", () => {
  const db = new Database(":memory:");
  db.run("PRAGMA foreign_keys = ON");
  db.run(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      title TEXT,
      model TEXT,
      model_messages TEXT,
      agent_name TEXT
    )
  `);
  db.run(`
    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE agent_tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      tool_name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      UNIQUE(agent_id, tool_name)
    )
  `);
  db.run(
    "INSERT INTO sessions (id, created_at, updated_at) VALUES ('session-1', 1, 1)",
  );
  db.run(
    "INSERT INTO agents (id, name, description, system_prompt, is_default, created_at, updated_at) VALUES ('agent-1', 'general_agent', '', '', 1, 1, 1)",
  );
  db.run(
    "INSERT INTO agent_tools (agent_id, tool_name, position) VALUES ('agent-1', 'bash', 0)",
  );

  runMigrations(db);

  const session = db.query("SELECT id, owner_uuid FROM sessions").get() as {
    id: string;
    owner_uuid: string | null;
  };
  const agent = db.query("SELECT id, owner_uuid FROM agents").get() as {
    id: string;
    owner_uuid: string | null;
  };
  expect(session).toEqual({ id: "session-1", owner_uuid: null });
  expect(agent).toEqual({ id: "agent-1", owner_uuid: null });
  expect(db.query("SELECT tool_name FROM agent_tools").get()).toEqual({
    tool_name: "bash",
  });
  expect(db.query("PRAGMA foreign_key_check").all()).toEqual([]);
  expect(
    (db.query("PRAGMA foreign_keys").get() as { foreign_keys: number })
      .foreign_keys,
  ).toBe(1);
  db.close();
});
