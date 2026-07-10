import { Router } from "express";
import { sendApiError } from "../http/errors";
import { handleRun } from "../run/runController";
import { sseManager } from "../run/sseManager";
import { AbortRunBodySchema } from "../schemas/run";
import { requireUserId } from "../userIdentity";

const router = Router();
router.post("/", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  void handleRun(req, res, sseManager, ownerUuid);
});

router.post("/abort", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  const parsed = AbortRunBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.json({ aborted: false });
    return;
  }
  const aborted = sseManager.abortRequest(parsed.data.requestId, ownerUuid);
  res.json({ aborted });
});

router.get("/active/:sessionId", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  const gen = sseManager.getActive(req.params.sessionId, ownerUuid);
  if (!gen) {
    res.json({ active: false });
    return;
  }
  res.json({ active: true, requestId: gen.requestId });
});

router.get("/stream/:sessionId", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  const gen = sseManager.getActive(req.params.sessionId, ownerUuid);
  if (!gen) {
    sendApiError(
      res,
      404,
      "NOT_FOUND",
      "No active generation for this session",
    );
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  for (const event of gen.eventBuffer) {
    sseManager.sendTo(res, event);
  }

  sseManager.attachClient(gen, res);

  const ping = setInterval(() => {
    res.write(":\n\n");
  }, 15000);

  res.on("close", () => {
    clearInterval(ping);
    if (!res.writableFinished) {
      sseManager.removeClient(gen, res);
    }
  });
});

export default router;
