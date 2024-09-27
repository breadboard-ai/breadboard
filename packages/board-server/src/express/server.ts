import express from 'express';
import bodyParser from 'body-parser';
import { BoardController } from './controllers/boardController.js';
import authenticate from './auth/auth.js';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import type { ServerConfig } from '../server/config.js';

export async function startServer(port: number = 3000) {
  const app = express();

  app.use(bodyParser.json());

  const boardController = new BoardController();

  const MODULE_PATH = dirname(fileURLToPath(import.meta.url));
  const ROOT_PATH = resolve(MODULE_PATH, "../../../");

  const HOST = process.env.HOST || "localhost";
  const HOSTNAME = `http://${HOST}:${port}`;
  const IS_PROD = process.env.NODE_ENV === "production";

  const serverConfig: ServerConfig = {
    allowedOrigins: new Set(
      (process.env.ALLOWED_ORIGINS ?? "")
        .split(/\s+/)
        .filter((origin) => origin !== "")
    ),
    hostname: HOSTNAME,
    viteDevServer: IS_PROD
      ? null
      : await createViteServer({
          server: { middlewareMode: true },
          appType: "custom",
          optimizeDeps: { esbuildOptions: { target: "esnext" } },
        }),
    rootPath: ROOT_PATH
  };

  app.use((req, res, next) => {
    res.locals.rootPath = ROOT_PATH;
    res.locals.serverConfig = serverConfig;
    next();
  });

  /**
   * Boards API routing logic:
   * GET /boards/ -> list boards
   * GET /boards/@:user/:name.json -> get a board
   * POST /boards/@:user/:name.json -> create/update/delete a board
   * GET /boards/@:user/:name.app -> serve frontend app for the board
   * GET /boards/@:user/:name.api -> serve API description for the board
   * POST /boards/@:user/:name.api/invoke -> BSE invoke entry point
   * POST /boards/@:user/:name.api/describe -> BSE describe entry point
   * POST /boards/@:user/:name.api/run -> Remote run entry point
   * GET /boards/@:user/:name.invite -> Get list of current invites for the board
   * POST /boards/@:user/:name.invite -> Create a new or delete existing invite
   */

  // Board API Routes
  app.get('/boards', boardController.list);
  app.post('/boards', authenticate, boardController.create);
  app.get('/boards/@:user/:boardName.json', boardController.get);
  app.post('/boards/@:user/:boardName.json', authenticate, boardController.update);
  // app.delete('/boards/@:user/:boardName.json', boardController.delete);
  app.post('/boards/@:user/:boardName.api/describe', boardController.serveApi);

  app.get('/boards/@:user/:boardName.app', boardController.serve);
  app.get('/boards/@:user/:boardName.api', boardController.describe);
  app.post('/boards/@:user/:boardName.api/invoke', boardController.invoke);
  app.post('/boards/@:user/:boardName.api/run', boardController.run);
  app.get('/boards/@:user/:boardName.invite', authenticate, boardController.inviteList);
  app.post('/boards/@:user/:boardName.invite', authenticate, boardController.inviteUpdate);

  // Global error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  const server = app.listen(port, () => {
    console.log(`Board server listening at ${HOSTNAME}`);
  });

  return { app, server, serverConfig };
}

// If this file is run directly, start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}