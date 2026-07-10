import { app } from "./app";
import { envConfig } from "./env";
import { logger } from "./logger";

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
