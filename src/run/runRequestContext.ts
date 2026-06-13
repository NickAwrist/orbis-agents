import type { Response } from "express";
import { buildServerRunPromptContext } from "../agents/agentManager";
import { DEFAULT_RUN_MODEL } from "../constants";
import { type SessionRow, getAgentByName, getSessionById } from "../db/index";
import { sendApiError } from "../http/errors";
import { sendValidationError } from "../http/validation";
import type { PromptContext } from "../prompts/render";
import { type RunBody, RunBodySchema } from "../schemas/run";
import { resolveEffectiveToolSessionDir } from "../sessionDirectory";

export type RunTurnContext = {
  body: RunBody;
  ephemeral: boolean;
  /** Empty string for ephemeral turns. */
  sessionId: string;
  model: string;
  agentName: string;
  toolSessionDir?: string;
  promptContext: PromptContext;
  persistedSession: SessionRow | null;
};

/**
 * Parse + validate `req.body` and resolve everything downstream needs
 * (persisted session, effective agent, tool dir, model). Writes a 4xx
 * response and returns `null` on failure so the caller can early-return.
 */
export function buildTurnContext(
  rawBody: unknown,
  res: Response,
): RunTurnContext | null {
  const parsed = RunBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    sendValidationError(res, parsed.error);
    return null;
  }
  const body = parsed.data;
  const ephemeral = body.ephemeral === true;
  const sessionId = body.sessionId ?? "";

  let persistedSession: SessionRow | null = null;
  if (!ephemeral) {
    if (!sessionId) {
      sendApiError(res, 400, "BAD_REQUEST", "sessionId required");
      return null;
    }
    persistedSession = getSessionById(sessionId);
    if (!persistedSession) {
      sendApiError(res, 404, "NOT_FOUND", "Session not found");
      return null;
    }
  }

  const agentName = body.agentName.trim();
  if (!getAgentByName(agentName)) {
    sendApiError(res, 400, "BAD_REQUEST", `Unknown agent: ${agentName}`);
    return null;
  }

  const toolSessionDir = resolveEffectiveToolSessionDir(
    body.sessionDirectory,
    persistedSession?.session_directory,
  );

  return {
    body,
    ephemeral,
    sessionId,
    model: body.model?.trim() || DEFAULT_RUN_MODEL,
    agentName,
    toolSessionDir,
    promptContext: buildServerRunPromptContext({
      metadata: body.metadata,
      toolSessionDir,
    }),
    persistedSession,
  };
}
