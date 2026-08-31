import { Router } from "express";
import { DEFAULT_RUN_MODEL } from "../constants";
import { getOpenRouterApiKey, listOpenRouterModels } from "../db/index";
import { errorMessage } from "../http/errors";
import { openRouterModelId } from "../llm/index";
import { InputCapability } from "../modelCapabilities";
import { getOllamaClient } from "../ollamaClient";
import { lookupOpenRouterModels } from "../openRouterModels";

const modelsRoutes = Router();

modelsRoutes.get("/", async (_req, res) => {
  let ollamaModels: Array<Record<string, unknown>> = [];
  let ollamaError: string | null = null;
  try {
    const { models } = await getOllamaClient().list();
    const shownModels = await Promise.allSettled(
      models.map((model) => getOllamaClient().show({ model: model.name })),
    );
    ollamaModels = models.map((m, index) => {
      const shown = shownModels[index];
      const capabilities =
        shown?.status === "fulfilled" && Array.isArray(shown.value.capabilities)
          ? shown.value.capabilities
          : [];
      return {
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
        inputCapabilities: [
          InputCapability.Text,
          ...(capabilities.includes("vision") ? [InputCapability.Image] : []),
        ],
      };
    });
  } catch (error) {
    ollamaError = errorMessage(error);
  }

  const openrouterConfigured = getOpenRouterApiKey().length > 0;
  const registeredOpenRouterModels = openrouterConfigured
    ? listOpenRouterModels()
    : [];
  const openRouterMetadata = await lookupOpenRouterModels(
    registeredOpenRouterModels.map((model) => model.route),
  );
  const openRouterModels = registeredOpenRouterModels.map((model) => ({
    id: openRouterModelId(model.route),
    name: model.name,
    provider: "openrouter",
    lab: model.ai_lab,
    route: model.route,
    configured: openrouterConfigured,
    inputCapabilities: openRouterMetadata.get(model.route)
      ?.inputCapabilities ?? [InputCapability.Text],
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
