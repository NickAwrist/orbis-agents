import { getDb } from "../connection";

export function agentNameExistsInDb(ownerUuid: string, name: string): boolean {
  return (
    getDb()
      .query("SELECT 1 FROM agents WHERE owner_uuid = ? AND name = ? LIMIT 1")
      .get(ownerUuid, name.trim()) != null
  );
}
