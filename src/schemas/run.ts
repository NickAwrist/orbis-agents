import { z } from "zod";

export const WireStepSchema = z.record(z.string(), z.unknown());

export const WireMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
  steps: z.array(WireStepSchema).optional(),
});

export type WireMessageInput = z.infer<typeof WireMessageSchema>;

const ModelMessageSchema = z.record(z.string(), z.unknown());

export const RunMetadataSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  preferredFormats: z.string().optional(),
});

export const RunBodySchema = z.object({
  sessionId: z.string().min(1).optional(),
  message: z.string().min(1),
  history: z.array(WireMessageSchema),
  model: z.string().optional(),
  modelMessages: z.array(ModelMessageSchema).nullable().optional(),
  ephemeral: z.boolean().optional(),
  agentName: z.string().min(1),
  metadata: RunMetadataSchema.optional(),
  sessionDirectory: z.string().optional(),
});

export type RunBody = z.infer<typeof RunBodySchema>;

export const AbortRunBodySchema = z.object({
  requestId: z.string().min(1),
});

export type AbortRunBody = z.infer<typeof AbortRunBodySchema>;
