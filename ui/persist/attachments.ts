import {
  type MessageAttachment,
  MessageAttachmentSchema,
} from "../../src/attachments/types";
import { readApiError } from "../lib/readApiError";
import { userScopedFetch } from "./userIdentity";

export async function uploadImageAttachment(
  sessionId: string,
  file: File,
): Promise<MessageAttachment> {
  const response = await userScopedFetch("/api/attachments", {
    method: "POST",
    headers: {
      "Content-Type": file.type,
      "X-Orbis-Session-ID": sessionId,
      "X-Attachment-Filename": encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const payload = (await response.json()) as { attachment?: unknown };
  const parsed = MessageAttachmentSchema.safeParse(payload.attachment);
  if (!parsed.success) throw new Error("The server returned an invalid image");
  return parsed.data;
}

export async function fetchAttachmentImage(id: string): Promise<Blob> {
  const response = await userScopedFetch(
    `/api/attachments/${encodeURIComponent(id)}`,
  );
  if (!response.ok) throw new Error(await readApiError(response));
  return response.blob();
}
