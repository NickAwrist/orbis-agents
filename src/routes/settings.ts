import { Router } from "express";
import { z } from "zod";
import {
  createOpenRouterModel,
  deleteOpenRouterModel,
  getDefaultRunAgent,
  getOpenRouterApiKey,
  getOpenRouterPromptCachingEnabled,
  listOpenRouterModels,
  setDefaultRunAgent,
  setOpenRouterApiKey,
  setOpenRouterPromptCachingEnabled,
} from "../db/index";
import { asyncRoute } from "../http/asyncRoute";
import { sendApiError } from "../http/errors";
import {
  lookupOpenRouterModel,
  lookupOpenRouterPromptCaching,
} from "../openRouterModels";

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
  res.json({
    hasKey: getOpenRouterApiKey().length > 0,
    promptCachingEnabled: getOpenRouterPromptCachingEnabled(),
  });
});

settingsRoutes.put("/openrouter", (req, res) => {
  const parsed = z
    .object({
      apiKey: z.string().max(512).optional(),
      promptCachingEnabled: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    sendApiError(res, 400, "BAD_REQUEST", "Invalid OpenRouter settings");
    return;
  }
  // Preserve the legacy behavior where an empty object clears the key, while
  // allowing the prompt-caching toggle to update independently of the secret.
  if (
    parsed.data.apiKey !== undefined ||
    parsed.data.promptCachingEnabled === undefined
  ) {
    setOpenRouterApiKey(parsed.data.apiKey ?? "");
  }
  if (parsed.data.promptCachingEnabled !== undefined) {
    setOpenRouterPromptCachingEnabled(parsed.data.promptCachingEnabled);
  }
  res.json({
    ok: true,
    hasKey: getOpenRouterApiKey().length > 0,
    promptCachingEnabled: getOpenRouterPromptCachingEnabled(),
  });
});

settingsRoutes.get(
  "/openrouter/models",
  asyncRoute(async (_req, res) => {
    const models = listOpenRouterModels();
    const support = await lookupOpenRouterPromptCaching(
      models.map((model) => model.route),
    );
    res.json({
      models: models.map((model) => ({
        ...model,
        promptCaching: support[model.route] ?? "unknown",
      })),
    });
  }),
);

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
      const details = await lookupOpenRouterModel(parsed.data.route);
      const model = createOpenRouterModel(details);
      res.status(201).json({
        ...model,
        promptCaching: details.promptCaching,
      });
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
