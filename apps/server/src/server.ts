import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/client.js";
import { logger } from "./lib/logger.js";
import { closeRealtime, initRealtime } from "./realtime/io.js";

const app = createApp();
const httpServer = createServer(app);
initRealtime(httpServer);

const server = httpServer.listen(env.PORT, () => {
  logger.info(`TeamBoard API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  await closeRealtime();
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
  // Do not leave the process hanging on keep-alive sockets.
  const timer = setTimeout(() => process.exit(0), 5_000);
  timer.unref();
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
