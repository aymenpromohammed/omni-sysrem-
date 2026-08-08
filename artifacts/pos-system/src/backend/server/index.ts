import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] ?? "3000";
const port = Number(rawPort) || 3000;

export function startServer(customPort?: number): Promise<void> {
  const targetPort = customPort ?? port;
  return new Promise((resolve, reject) => {
    const server = app.listen(targetPort, "0.0.0.0", () => {
      logger.info({ port: targetPort }, `Server listening on http://0.0.0.0:${targetPort}`);
      resolve();
    });
    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        logger.warn(`Port ${targetPort} is already in use. Proceeding...`);
        resolve();
      } else {
        reject(err);
      }
    });
  });
}

if (require.main === module || process.env.AUTO_START_SERVER === "true") {
  startServer().catch((err) => {
    logger.error({ err }, "Error starting server");
  });
}

export default app;
