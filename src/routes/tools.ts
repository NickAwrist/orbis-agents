import { Router } from "express";
import { sandboxRunner } from "../sandbox/SandboxRunner";
import { BUILTIN_TOOLS } from "../tools/builtinTools";

const toolsRoutes = Router();

toolsRoutes.get("/", async (_req, res) => {
  res.json({
    tools: BUILTIN_TOOLS,
    capabilities: { shell: await sandboxRunner.capability() },
  });
});

export default toolsRoutes;
