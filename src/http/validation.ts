import type { Response } from "express";
import type { ZodError } from "zod";
import { sendApiError } from "./errors";

export function sendValidationError(
  res: Response,
  error: ZodError,
  message = "Invalid request body",
): void {
  sendApiError(res, 400, "VALIDATION_ERROR", message, error.flatten());
}
