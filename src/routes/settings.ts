import { Router } from "express";
import { getDefaultRunAgent, setDefaultRunAgent } from "../db/index";
import { sendApiError } from "../http/errors";

const settingsRoutes = Router();

settingsRoutes.get("/default-run-agent", (_req, res) => {
  res.json({ agentName: getDefaultRunAgent() });
});

settingsRoutes.put("/default-run-agent", (req, res) => {
  const raw = (req.body as { agentName?: unknown }).agentName;
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name || !setDefaultRunAgent(name)) {
    sendApiError(res, 400, "BAD_REQUEST", "Invalid agent name");
    return;
  }
  res.json({ ok: true, agentName: getDefaultRunAgent() });
});

export default settingsRoutes;
