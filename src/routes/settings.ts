import { Router } from "express";
import { z } from "zod";
import {
  createOpenRouterModel,
  deleteOpenRouterModel,
  getDefaultRunAgent,
  getOpenRouterApiKey,
  listOpenRouterModels,
  setDefaultRunAgent,
  setOpenRouterApiKey,
} from "../db/index";
import { asyncRoute } from "../http/asyncRoute";
import { sendApiError } from "../http/errors";
import { lookupOpenRouterModel } from "../openRouterModels";

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

settingsRoutes.get("/openrouter", (_req, res) => {
  res.json({ hasKey: getOpenRouterApiKey().length > 0 });
});

settingsRoutes.put("/openrouter", (req, res) => {
  const parsed = z
    .object({ apiKey: z.string().max(512).default("") })
    .safeParse(req.body);
  if (!parsed.success) {
    sendApiError(res, 400, "BAD_REQUEST", "apiKey must be a string");
    return;
  }
  setOpenRouterApiKey(parsed.data.apiKey);
  res.json({ ok: true, hasKey: getOpenRouterApiKey().length > 0 });
});

settingsRoutes.get("/openrouter/models", (_req, res) => {
  res.json({ models: listOpenRouterModels() });
});

const OpenRouterRouteSchema = z.object({
  route: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .regex(/^~?[a-z0-9._:-]+\/[a-z0-9._:-]+$/i),
});

settingsRoutes.post(
  "/openrouter/models/lookup",
  asyncRoute(async (req, res) => {
    const parsed = OpenRouterRouteSchema.safeParse(req.body);
    if (!parsed.success) {
      sendApiError(res, 400, "BAD_REQUEST", "route must look like lab/model");
      return;
    }
    res.json(await lookupOpenRouterModel(parsed.data.route));
  }),
);

settingsRoutes.post(
  "/openrouter/models",
  asyncRoute(async (req, res) => {
    const parsed = OpenRouterRouteSchema.safeParse(req.body);
    if (!parsed.success) {
      sendApiError(res, 400, "BAD_REQUEST", "route must look like lab/model");
      return;
    }
    try {
      const model = createOpenRouterModel(
        await lookupOpenRouterModel(parsed.data.route),
      );
      res.status(201).json(model);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed")
      ) {
        sendApiError(
          res,
          409,
          "CONFLICT",
          "That OpenRouter route is registered",
        );
        return;
      }
      throw error;
    }
  }),
);

settingsRoutes.delete("/openrouter/models/:id", (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    sendApiError(res, 400, "BAD_REQUEST", "Invalid model ID");
    return;
  }
  if (!deleteOpenRouterModel(id)) {
    sendApiError(res, 404, "NOT_FOUND", "OpenRouter model not found");
    return;
  }
  res.json({ ok: true });
});

export default settingsRoutes;
