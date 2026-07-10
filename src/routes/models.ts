import { Router } from "express";
import { DEFAULT_RUN_MODEL } from "../constants";
import { getOpenRouterApiKey, listOpenRouterModels } from "../db/index";
import { errorMessage } from "../http/errors";
import { openRouterModelId } from "../llm/index";
import { getOllamaClient } from "../ollamaClient";

const modelsRoutes = Router();

modelsRoutes.get("/", async (_req, res) => {
  let ollamaModels: Array<Record<string, unknown>> = [];
  let ollamaError: string | null = null;
  try {
    const { models } = await getOllamaClient().list();
    ollamaModels = models.map((m) => ({
      id: m.name,
      name: m.name,
      provider: "ollama",
      lab: "Ollama",
      size: m.size,
      modified_at:
        m.modified_at instanceof Date
          ? m.modified_at.toISOString()
          : String(m.modified_at),
      digest: m.digest,
      details: m.details,
    }));
  } catch (error) {
    ollamaError = errorMessage(error);
  }

  const openrouterConfigured = getOpenRouterApiKey().length > 0;
  const openRouterModels = listOpenRouterModels().map((model) => ({
    id: openRouterModelId(model.route),
    name: model.name,
    provider: "openrouter",
    lab: model.ai_lab,
    route: model.route,
    configured: openrouterConfigured,
  }));

  res.json({
    defaultModel: DEFAULT_RUN_MODEL,
    models: [...ollamaModels, ...openRouterModels],
    providers: {
      ollama: { connected: ollamaError === null, error: ollamaError },
      openrouter: { configured: openrouterConfigured },
    },
  });
});

export default modelsRoutes;
