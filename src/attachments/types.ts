import { z } from "zod";

export const ImageMimeType = {
  Png: "image/png",
  Jpeg: "image/jpeg",
  Webp: "image/webp",
  Gif: "image/gif",
} as const;

export type ImageMimeType = (typeof ImageMimeType)[keyof typeof ImageMimeType];

export const IMAGE_MIME_TYPES = [
  ImageMimeType.Png,
  ImageMimeType.Jpeg,
  ImageMimeType.Webp,
  ImageMimeType.Gif,
] as const;
export const ImageMimeTypeSchema = z.enum(IMAGE_MIME_TYPES);

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGES_PER_MESSAGE = 4;

export const MessageAttachmentSchema = z.object({
  id: z.uuid(),
  kind: z.literal("image"),
  name: z.string().min(1).max(255),
  mimeType: ImageMimeTypeSchema,
  size: z.number().int().positive().max(MAX_IMAGE_BYTES),
});

export type MessageAttachment = z.infer<typeof MessageAttachmentSchema>;

export function imageUrl(attachmentId: string): string {
  return `/api/attachments/${encodeURIComponent(attachmentId)}`;
}
