import { Router } from "express";
import { z } from "zod";
import { approvalManager } from "../approvals/ApprovalManager";
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

const ApprovalBodySchema = z.object({ approved: z.boolean() });

router.post("/:requestId/approvals/:approvalId", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  const parsed = ApprovalBodySchema.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(res, 400, "BAD_REQUEST", "approved must be a boolean");
    return;
  }
  const resolved = approvalManager.resolve({
    ownerUuid,
    requestId: req.params.requestId,
    approvalId: req.params.approvalId,
    approved: parsed.data.approved,
  });
  if (!resolved) {
    sendApiError(res, 404, "NOT_FOUND", "Approval request not found");
    return;
  }
  res.json({ ok: true });
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
