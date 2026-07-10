import type { Request, Response } from "express";
import { createRunPersistence } from "./runPersistence";
import { buildTurnContext } from "./runRequestContext";
import { openRunStream } from "./runStream";
import { runTurn } from "./runTurnRunner";
import type { SseManager } from "./sseManager";

/**
 * Thin orchestration layer: validate + resolve context, open an SSE
 * stream, hand those off to the turn runner, then close the stream.
 * All real work lives in the injected collaborators.
 */
export async function handleRun(
  req: Request,
  res: Response,
  sse: SseManager,
  ownerUuid: string,
): Promise<void> {
  const ctx = buildTurnContext(req.body, res, ownerUuid);
  if (!ctx) return;

  const stream = openRunStream(res, sse, {
    ephemeral: ctx.ephemeral,
    sessionId: ctx.sessionId,
    ownerUuid,
  });
  const persistence = createRunPersistence({
    sessionId: ctx.sessionId,
    model: ctx.model,
    ephemeral: ctx.ephemeral,
    ownerUuid,
  });

  try {
    await runTurn(ctx, stream, persistence);
  } finally {
    stream.close();
  }
}
