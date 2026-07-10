import crypto from "node:crypto";
import { getDb } from "../connection";
import { DEFAULT_RUN_AGENT_KEY } from "../constants";
import type { AgentRow, AgentWithTools } from "./types";

export function listAgents(ownerUuid: string): AgentWithTools[] {
  const db = getDb();
  const rows = db
    .query(
      "SELECT id, owner_uuid, name, description, system_prompt, is_default, created_at, updated_at FROM agents WHERE owner_uuid = ? ORDER BY created_at ASC",
    )
    .all(ownerUuid) as AgentRow[];
  const toolStmt = db.query(
    "SELECT tool_name FROM agent_tools WHERE agent_id = ? ORDER BY position ASC",
  );
  return rows.map((r) => ({
    ...r,
    tools: (toolStmt.all(r.id) as { tool_name: string }[]).map(
      (t) => t.tool_name,
    ),
  }));
}

export function getAgentById(
  ownerUuid: string,
  id: string,
): AgentWithTools | null {
  const db = getDb();
  const row = db
    .query(
      "SELECT id, owner_uuid, name, description, system_prompt, is_default, created_at, updated_at FROM agents WHERE owner_uuid = ? AND id = ?",
    )
    .get(ownerUuid, id) as AgentRow | null;
  if (!row) return null;
  const tools = (
    db
      .query(
        "SELECT tool_name FROM agent_tools WHERE agent_id = ? ORDER BY position ASC",
      )
      .all(id) as { tool_name: string }[]
  ).map((t) => t.tool_name);
  return { ...row, tools };
}

export function getAgentByName(
  ownerUuid: string,
  name: string,
): AgentWithTools | null {
  const db = getDb();
  const row = db
    .query(
      "SELECT id, owner_uuid, name, description, system_prompt, is_default, created_at, updated_at FROM agents WHERE owner_uuid = ? AND name = ?",
    )
    .get(ownerUuid, name) as AgentRow | null;
  if (!row) return null;
  const tools = (
    db
      .query(
        "SELECT tool_name FROM agent_tools WHERE agent_id = ? ORDER BY position ASC",
      )
      .all(row.id) as { tool_name: string }[]
  ).map((t) => t.tool_name);
  return { ...row, tools };
}

export function createAgentRow(
  ownerUuid: string,
  data: {
    name: string;
    description: string;
    system_prompt: string;
    tools: string[];
  },
): AgentWithTools {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  const tx = db.transaction(() => {
    db.run(
      "INSERT INTO agents (id, owner_uuid, name, description, system_prompt, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
      [
        id,
        ownerUuid,
        data.name,
        data.description,
        data.system_prompt,
        now,
        now,
      ],
    );
    const ins = db.prepare(
      "INSERT INTO agent_tools (agent_id, tool_name, position) VALUES (?, ?, ?)",
    );
    data.tools.forEach((t, i) => ins.run(id, t, i));
  });
  tx();
  return {
    id,
    owner_uuid: ownerUuid,
    name: data.name,
    description: data.description,
    system_prompt: data.system_prompt,
    is_default: 0,
    created_at: now,
    updated_at: now,
    tools: data.tools,
  };
}

export function updateAgentRow(
  ownerUuid: string,
  id: string,
  data: {
    name: string;
    description: string;
    system_prompt: string;
    tools: string[];
  },
): boolean {
  const db = getDb();
  const existing = getAgentById(ownerUuid, id);
  if (!existing) return false;
  const now = Date.now();
  const tx = db.transaction(() => {
    db.run(
      "UPDATE agents SET name = ?, description = ?, system_prompt = ?, updated_at = ? WHERE owner_uuid = ? AND id = ?",
      [data.name, data.description, data.system_prompt, now, ownerUuid, id],
    );
    db.run("DELETE FROM agent_tools WHERE agent_id = ?", [id]);
    const ins = db.prepare(
      "INSERT INTO agent_tools (agent_id, tool_name, position) VALUES (?, ?, ?)",
    );
    data.tools.forEach((t, i) => ins.run(id, t, i));
  });
  tx();
  return true;
}

export function deleteAgentRow(ownerUuid: string, id: string): boolean {
  const db = getDb();
  const fallback = "general_agent";
  const row = db
    .query(
      "SELECT name FROM agents WHERE owner_uuid = ? AND id = ? AND name != ?",
    )
    .get(ownerUuid, id, fallback) as { name: string } | null;
  if (!row) return false;
  db.run(
    "UPDATE user_settings SET value = ? WHERE owner_uuid = ? AND key = ? AND value = ?",
    [fallback, ownerUuid, DEFAULT_RUN_AGENT_KEY, row.name],
  );
  const r = db.run("DELETE FROM agents WHERE owner_uuid = ? AND id = ?", [
    ownerUuid,
    id,
  ]);
  return r.changes > 0;
}
