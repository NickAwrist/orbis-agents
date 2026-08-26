import crypto from "node:crypto";
import { getDb } from "../connection";
import type { SkillRow } from "./types";

export type SkillWriteData = {
  name: string;
  description: string;
  instructions: string;
};

export function listSkills(ownerUuid: string): SkillRow[] {
  return getDb()
    .query(
      "SELECT id, owner_uuid, name, description, instructions, created_at, updated_at FROM skills WHERE owner_uuid = ? ORDER BY created_at ASC",
    )
    .all(ownerUuid) as SkillRow[];
}

export function getSkillById(ownerUuid: string, id: string): SkillRow | null {
  return getDb()
    .query(
      "SELECT id, owner_uuid, name, description, instructions, created_at, updated_at FROM skills WHERE owner_uuid = ? AND id = ?",
    )
    .get(ownerUuid, id) as SkillRow | null;
}

export function getSkillByName(
  ownerUuid: string,
  name: string,
): SkillRow | null {
  return getDb()
    .query(
      "SELECT id, owner_uuid, name, description, instructions, created_at, updated_at FROM skills WHERE owner_uuid = ? AND name = ?",
    )
    .get(ownerUuid, name) as SkillRow | null;
}

export function createSkillRow(
  ownerUuid: string,
  data: SkillWriteData,
): SkillRow {
  const id = crypto.randomUUID();
  const now = Date.now();
  getDb().run(
    "INSERT INTO skills (id, owner_uuid, name, description, instructions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, ownerUuid, data.name, data.description, data.instructions, now, now],
  );
  return {
    id,
    owner_uuid: ownerUuid,
    ...data,
    created_at: now,
    updated_at: now,
  };
}

export function updateSkillRow(
  ownerUuid: string,
  id: string,
  data: SkillWriteData,
): SkillRow | null {
  const now = Date.now();
  const result = getDb().run(
    "UPDATE skills SET name = ?, description = ?, instructions = ?, updated_at = ? WHERE owner_uuid = ? AND id = ?",
    [data.name, data.description, data.instructions, now, ownerUuid, id],
  );
  if (result.changes === 0) return null;
  return getSkillById(ownerUuid, id);
}

export function deleteSkillRow(ownerUuid: string, id: string): boolean {
  return (
    getDb().run("DELETE FROM skills WHERE owner_uuid = ? AND id = ?", [
      ownerUuid,
      id,
    ]).changes > 0
  );
}
