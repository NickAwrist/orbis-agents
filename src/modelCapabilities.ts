import { z } from "zod";

export const InputCapability = {
  Text: "text",
  Image: "image",
  File: "file",
  Audio: "audio",
  Video: "video",
} as const;

export type InputCapability =
  (typeof InputCapability)[keyof typeof InputCapability];

const INPUT_CAPABILITY_VALUES = [
  InputCapability.Text,
  InputCapability.Image,
  InputCapability.File,
  InputCapability.Audio,
  InputCapability.Video,
] as const;

export const InputCapabilitySchema = z.enum(INPUT_CAPABILITY_VALUES);

export function parseInputCapabilities(value: unknown): InputCapability[] {
  if (!Array.isArray(value)) return [];

  const capabilities = new Set<InputCapability>();
  for (const entry of value) {
    const parsed = InputCapabilitySchema.safeParse(entry);
    if (parsed.success) capabilities.add(parsed.data);
  }
  return Array.from(capabilities);
}
