import { Router } from "express";
import { BUILTIN_TOOLS } from "../agents/agentManager";
import {
  isBuiltinToolEnabled,
  refreshToolAvailability,
} from "../tools/availability";

const toolsRoutes = Router();

toolsRoutes.get("/", async (_req, res) => {
  await refreshToolAvailability();
  res.json({ tools: BUILTIN_TOOLS.filter(isBuiltinToolEnabled) });
});

export default toolsRoutes;
