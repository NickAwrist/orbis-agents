import { Router } from "express";
import { withContainerLoopbackHint } from "../containerNetworkHint";
import { getSearXNGHost, setSearXNGHost } from "../db/index";
import { DEFAULT_SEARXNG_HOST } from "../env";
import {
  SearXNGConfigPutSchema,
  SearXNGTestBodySchema,
} from "../schemas/searxng";
import {
  SearXNGClient,
  getResolvedSearXNGHost,
  getSearXNGClient,
  invalidateSearXNGClient,
} from "../searxng/client";
import { setToolServiceStatus } from "../tools/availability";

const router = Router();

router.get("/health", async (_req, res) => {
  const result = await getSearXNGClient().healthCheck(3000);
  setToolServiceStatus("searxng", result.ok);
  res.json({ connected: result.ok, error: result.error });
});

router.get("/config", (_req, res) => {
  res.json({
    host: getSearXNGHost() || DEFAULT_SEARXNG_HOST,
    effectiveHost: getResolvedSearXNGHost(),
  });
});

router.put("/config", (req, res) => {
  const parsed = SearXNGConfigPutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
    return;
  }
  if (parsed.data.host !== undefined) {
    setSearXNGHost(parsed.data.host);
    invalidateSearXNGClient();
  }
  res.json({
    host: getSearXNGHost() || DEFAULT_SEARXNG_HOST,
    effectiveHost: getResolvedSearXNGHost(),
  });
});

router.post("/test", async (req, res) => {
  const parsed = SearXNGTestBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
    return;
  }
  const raw = parsed.data.host?.trim() ?? "";
  const url = raw || getResolvedSearXNGHost();
  const result = await new SearXNGClient(url).healthCheck(5000);
  res.json({
    ok: result.ok,
    error: result.error
      ? withContainerLoopbackHint(result.error, url)
      : undefined,
  });
});

export default router;
