import { z } from "zod";

export const SearXNGConfigPutSchema = z.object({
  host: z.string().optional(),
});

export const SearXNGTestBodySchema = z.object({
  host: z.string().optional(),
});
