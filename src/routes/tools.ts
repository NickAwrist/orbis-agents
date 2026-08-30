import { Router } from "express";
import { BUILTIN_TOOLS } from "../tools/builtinTools";

const toolsRoutes = Router();

toolsRoutes.get("/", async (_req, res) => {
  res.json({ tools: BUILTIN_TOOLS });
});

export default toolsRoutes;
