import { Router } from "express";
import { DEFAULT_RUN_MODEL } from "../constants";
import { errorMessage, sendApiError } from "../http/errors";
import { getOllamaClient } from "../ollamaClient";

const modelsRoutes = Router();

modelsRoutes.get("/", async (_req, res) => {
  try {
    const { models } = await getOllamaClient().list();
    res.json({
      defaultModel: DEFAULT_RUN_MODEL,
      models: models.map((m) => ({
        name: m.name,
        size: m.size,
        modified_at:
          m.modified_at instanceof Date
            ? m.modified_at.toISOString()
            : String(m.modified_at),
        digest: m.digest,
        details: m.details,
      })),
    });
  } catch (e) {
    sendApiError(res, 502, "UPSTREAM_ERROR", errorMessage(e), {
      defaultModel: DEFAULT_RUN_MODEL,
      models: [],
    });
  }
});

export default modelsRoutes;
