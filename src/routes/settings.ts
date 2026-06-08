import { Router } from "express";
import { getDefaultRunAgent, setDefaultRunAgent } from "../db/index";

const settingsRoutes = Router();

settingsRoutes.get("/default-run-agent", (_req, res) => {
  res.json({ agentName: getDefaultRunAgent() });
});

settingsRoutes.put("/default-run-agent", (req, res) => {
  const raw = (req.body as { agentName?: unknown }).agentName;
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name || !setDefaultRunAgent(name)) {
    res.status(400).json({ error: "Invalid agent name" });
    return;
  }
  res.json({ ok: true, agentName: getDefaultRunAgent() });
});

export default settingsRoutes;
