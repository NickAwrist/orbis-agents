import type { Database } from "bun:sqlite";
import { MessageAttachmentSchema } from "../attachments/types";

/** Older initial-run writes serialized AttachmentRow.data into history JSON. */
export function migrateAttachmentMetadata(db: Database) {
  const rows = db
    .query(
      `SELECT id, attachments FROM messages WHERE attachments LIKE '%"data":%'`,
    )
    .all() as Array<{ id: number; attachments: string }>;
  const update = db.prepare("UPDATE messages SET attachments = ? WHERE id = ?");
  db.transaction(() => {
    for (const row of rows) {
      let raw: unknown;
      try {
        raw = JSON.parse(row.attachments);
      } catch {
        continue;
      }
      const parsed = MessageAttachmentSchema.array().safeParse(raw);
      // Leave malformed historical entries untouched for manual recovery.
      if (parsed.success) update.run(JSON.stringify(parsed.data), row.id);
    }
  })();
}
