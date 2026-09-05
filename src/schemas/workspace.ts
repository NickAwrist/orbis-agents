import { z } from "zod";

export const SelectDirectorySchema = z.object({
  path: z.string().trim().min(1).max(4096),
});
