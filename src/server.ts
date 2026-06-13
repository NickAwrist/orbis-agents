import { existsSync } from "node:fs";
import { join } from "node:path";
import cors from "cors";
import express from "express";
import { getDb } from "./db/index";
import { envConfig } from "./env";
import { errorHandler, sendApiError } from "./http/errors";
import { logger } from "./logger";
import agentsRoutes from "./routes/agents";
import comfyuiRoutes from "./routes/comfyui";
import modelsRoutes from "./routes/models";
import ollamaRoutes from "./routes/ollama";
import runRoutes from "./routes/runs";
import searxngRoutes from "./routes/searxng";
import sessionRoutes from "./routes/sessions";
import settingsRoutes from "./routes/settings";
import toolsRoutes from "./routes/tools";

getDb();

const DEFAULT_FRONTEND_PORTS = [5173, 5174];
const allowedFrontendPorts = Array.from(
  new Set([...DEFAULT_FRONTEND_PORTS, envConfig.frontendPort]),
);
const allowedOrigins = allowedFrontendPorts.flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]);

const app = express();
app.use(
  cors({
    origin: allowedOrigins,
    credentials: false,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use("/api/tools", toolsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/agents", agentsRoutes);
app.use("/api/comfyui", comfyuiRoutes);
app.use("/api/ollama", ollamaRoutes);
app.use("/api/searxng", searxngRoutes);
app.use("/api/models", modelsRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/runs", runRoutes);

const distPath = join(process.cwd(), "dist");
const indexPath = join(distPath, "index.html");

if (envConfig.serveFrontend && existsSync(indexPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
      next();
      return;
    }

    res.sendFile(indexPath);
  });
}

app.use("/api", (_req, res) => {
  sendApiError(res, 404, "NOT_FOUND", "API route not found");
});

app.use(errorHandler);

const PORT = envConfig.backendPort;
app.listen(PORT, envConfig.backendHost, () => {
  logger.info(
    {
      port: PORT,
      host: envConfig.backendHost,
      serveFrontend: envConfig.serveFrontend,
    },
    "API server listening",
  );
});
