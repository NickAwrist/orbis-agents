import type { Database } from "bun:sqlite";
import crypto from "node:crypto";
import { isBuiltinToolName } from "../../tools/builtinTools";
import { getDb } from "../connection";
import { DEFAULT_RUN_AGENT_KEY } from "../constants";
import type { SkillRow } from "../skills/types";
import type { AgentData, AgentRow, AgentWriteData } from "./types";

export class AgentCapabilityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentCapabilityValidationError";
  }
}

const AGENT_COLUMNS =
  "id, owner_uuid, name, description, system_prompt, is_default, created_at, updated_at";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeWriteData(data: AgentWriteData): AgentWriteData {
  return {
    ...data,
    tools: unique(data.tools),
    skill_ids: unique(data.skill_ids),
    delegate_agent_ids: unique(data.delegate_agent_ids),
  };
}

function hydrateAgent(db: Database, row: AgentRow): AgentData {
  const tools = (
    db
      .query(
        "SELECT tool_name FROM agent_tools WHERE agent_id = ? ORDER BY position ASC",
      )
      .all(row.id) as Array<{ tool_name: string }>
  ).map((item) => item.tool_name);
  const skillIds = (
    db
      .query(`
        SELECT agent_skills.skill_id
        FROM agent_skills
        INNER JOIN skills ON skills.id = agent_skills.skill_id
        WHERE agent_skills.agent_id = ? AND skills.owner_uuid = ?
        ORDER BY agent_skills.position ASC
      `)
      .all(row.id, row.owner_uuid) as Array<{ skill_id: string }>
  ).map((item) => item.skill_id);
  const delegateAgentIds = (
    db
      .query(`
        SELECT agent_delegations.target_agent_id
        FROM agent_delegations
        INNER JOIN agents target ON target.id = agent_delegations.target_agent_id
        WHERE agent_delegations.source_agent_id = ? AND target.owner_uuid = ?
        ORDER BY agent_delegations.position ASC
      `)
      .all(row.id, row.owner_uuid) as Array<{ target_agent_id: string }>
  ).map((item) => item.target_agent_id);

  return {
    ...row,
    tools,
    skill_ids: skillIds,
    delegate_agent_ids: delegateAgentIds,
  };
}

function validateOwnedIds(
  db: Database,
  table: "skills" | "agents",
  ownerUuid: string,
  ids: string[],
  label: string,
): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(", ");
  const rows = db
    .query(
      `SELECT id FROM ${table} WHERE owner_uuid = ? AND id IN (${placeholders})`,
    )
    .all(ownerUuid, ...ids) as Array<{ id: string }>;
  if (rows.length !== ids.length) {
    throw new AgentCapabilityValidationError(
      `One or more ${label} do not exist or belong to another user`,
    );
  }
}

function validateCapabilities(
  db: Database,
  ownerUuid: string,
  sourceAgentId: string,
  data: AgentWriteData,
): void {
  const unknownTool = data.tools.find((tool) => !isBuiltinToolName(tool));
  if (unknownTool) {
    throw new AgentCapabilityValidationError(
      `Unknown built-in tool '${unknownTool}'`,
    );
  }
  validateOwnedIds(db, "skills", ownerUuid, data.skill_ids, "skill IDs");
  validateOwnedIds(
    db,
    "agents",
    ownerUuid,
    data.delegate_agent_ids,
    "delegate agent IDs",
  );
  if (data.delegate_agent_ids.includes(sourceAgentId)) {
    throw new AgentCapabilityValidationError(
      "An agent cannot delegate directly to itself",
    );
  }
}

function insertCapabilities(
  db: Database,
  agentId: string,
  data: AgentWriteData,
): void {
  const insertTool = db.prepare(
    "INSERT INTO agent_tools (agent_id, tool_name, position) VALUES (?, ?, ?)",
  );
  const insertSkill = db.prepare(
    "INSERT INTO agent_skills (agent_id, skill_id, position) VALUES (?, ?, ?)",
  );
  const insertDelegation = db.prepare(
    "INSERT INTO agent_delegations (source_agent_id, target_agent_id, position) VALUES (?, ?, ?)",
  );
  data.tools.forEach((tool, position) =>
    insertTool.run(agentId, tool, position),
  );
  data.skill_ids.forEach((skillId, position) =>
    insertSkill.run(agentId, skillId, position),
  );
  data.delegate_agent_ids.forEach((targetId, position) =>
    insertDelegation.run(agentId, targetId, position),
  );
}

export function listAgents(ownerUuid: string): AgentData[] {
  const db = getDb();
  const rows = db
    .query(
      `SELECT ${AGENT_COLUMNS} FROM agents WHERE owner_uuid = ? ORDER BY created_at ASC`,
    )
    .all(ownerUuid) as AgentRow[];
  return rows.map((row) => hydrateAgent(db, row));
}

export function getAgentById(ownerUuid: string, id: string): AgentData | null {
  const db = getDb();
  const row = db
    .query(
      `SELECT ${AGENT_COLUMNS} FROM agents WHERE owner_uuid = ? AND id = ?`,
    )
    .get(ownerUuid, id) as AgentRow | null;
  return row ? hydrateAgent(db, row) : null;
}

export function getAgentByName(
  ownerUuid: string,
  name: string,
): AgentData | null {
  const db = getDb();
  const row = db
    .query(
      `SELECT ${AGENT_COLUMNS} FROM agents WHERE owner_uuid = ? AND name = ?`,
    )
    .get(ownerUuid, name) as AgentRow | null;
  return row ? hydrateAgent(db, row) : null;
}

export function listAssignedSkills(
  ownerUuid: string,
  agentId: string,
): SkillRow[] {
  return getDb()
    .query(`
      SELECT
        skills.id,
        skills.owner_uuid,
        skills.name,
        skills.description,
        skills.instructions,
        skills.created_at,
        skills.updated_at
      FROM agent_skills
      INNER JOIN agents ON agents.id = agent_skills.agent_id
      INNER JOIN skills ON skills.id = agent_skills.skill_id
      WHERE agent_skills.agent_id = ?
        AND agents.owner_uuid = ?
        AND skills.owner_uuid = ?
      ORDER BY agent_skills.position ASC
    `)
    .all(agentId, ownerUuid, ownerUuid) as SkillRow[];
}

export function listDelegationTargets(
  ownerUuid: string,
  sourceAgentId: string,
): AgentRow[] {
  return getDb()
    .query(`
      SELECT
        target.id,
        target.owner_uuid,
        target.name,
        target.description,
        target.system_prompt,
        target.is_default,
        target.created_at,
        target.updated_at
      FROM agent_delegations
      INNER JOIN agents source ON source.id = agent_delegations.source_agent_id
      INNER JOIN agents target ON target.id = agent_delegations.target_agent_id
      WHERE agent_delegations.source_agent_id = ?
        AND source.owner_uuid = ?
        AND target.owner_uuid = ?
      ORDER BY agent_delegations.position ASC
    `)
    .all(sourceAgentId, ownerUuid, ownerUuid) as AgentRow[];
}

export function createAgentRow(
  ownerUuid: string,
  input: AgentWriteData,
): AgentData {
  const db = getDb();
  const data = normalizeWriteData(input);
  const id = crypto.randomUUID();
  const now = Date.now();
  const tx = db.transaction(() => {
    validateCapabilities(db, ownerUuid, id, data);
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
    insertCapabilities(db, id, data);
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
    skill_ids: data.skill_ids,
    delegate_agent_ids: data.delegate_agent_ids,
  };
}

export function updateAgentRow(
  ownerUuid: string,
  id: string,
  input: AgentWriteData,
): boolean {
  const db = getDb();
  const data = normalizeWriteData(input);
  const now = Date.now();
  const tx = db.transaction(() => {
    const existing = db
      .query("SELECT 1 FROM agents WHERE owner_uuid = ? AND id = ?")
      .get(ownerUuid, id);
    if (!existing) return false;

    validateCapabilities(db, ownerUuid, id, data);
    db.run(
      "UPDATE agents SET name = ?, description = ?, system_prompt = ?, updated_at = ? WHERE owner_uuid = ? AND id = ?",
      [data.name, data.description, data.system_prompt, now, ownerUuid, id],
    );
    db.run("DELETE FROM agent_tools WHERE agent_id = ?", [id]);
    db.run("DELETE FROM agent_skills WHERE agent_id = ?", [id]);
    db.run("DELETE FROM agent_delegations WHERE source_agent_id = ?", [id]);
    insertCapabilities(db, id, data);
    return true;
  });
  return tx();
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
  const result = db.run("DELETE FROM agents WHERE owner_uuid = ? AND id = ?", [
    ownerUuid,
    id,
  ]);
  return result.changes > 0;
}
