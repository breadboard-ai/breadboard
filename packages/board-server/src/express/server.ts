import express from 'express';
import bodyParser from 'body-parser';
import authenticate from './auth/auth.js';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import type { ServerConfig } from '../server/config.js';
import { home } from './home/home.js';
import { info } from './info/info.js';
import { proxy } from './proxy/proxy.js';
import { list } from './boards/list.js';
import { create } from './boards/create.js';
import { get } from './boards/get.js';
import { update } from './boards/update.js';
import { describe } from './boards/describe.js';
import { serve } from './boards/serve.js';
import { serveApi } from './boards/serve-api.js';
import { invoke } from './boards/invoke.js';
import { run } from './boards/run.js';
import { inviteList } from './boards/invite-list.js';
import { inviteUpdate } from './boards/invite-update.js';
import cors from 'cors';
import { type CorsOptions } from 'cors';

export async function startServer(port: number = 3000) {
  const app = express();

  app.use(bodyParser.json());
  const serverConfig: ServerConfig = await createServerConfig(port);

  app.use((req, res, next) => {
    res.locals.rootPath = serverConfig.rootPath;
    res.locals.serverConfig = serverConfig;
    next();
  });

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (serverConfig.allowedOrigins.has(origin ?? "") || !origin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  };

  // Apply CORS middleware to all routes
  app.use(cors(corsOptions));

  // Home routes
  app.get('/', home);

  // Info routes
  app.get('/info', info);

  // Boards routes
  app.get('/boards', list); // List all boards
  app.post('/boards', authenticate, create); // Create a new board
  app.get('/boards/@:user/:boardName.json', get); // Get a specific board
  app.post('/boards/@:user/:boardName.json', authenticate, update); // Update a specific board
  app.post('/boards/@:user/:boardName.api/describe', describe); // BSE describe entry point
  app.get('/boards/@:user/:boardName.app', serve); // Serve frontend app for the board
  app.get('/boards/@:user/:boardName.api', serveApi); // Serve API description for the board
  app.post('/boards/@:user/:boardName.api/invoke', invoke); // BSE invoke entry point
  app.post('/boards/@:user/:boardName.api/run', run); // Remote run entry point
  app.get('/boards/@:user/:boardName.invite', authenticate, inviteList); // Get list of current invites for the board
  app.post('/boards/@:user/:boardName.invite', authenticate, inviteUpdate); // Create a new or delete existing invite
  
  // Proxy routes
  app.post('/proxy', proxy);

  // Global error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  const server = app.listen(port, () => {
    console.log(`[Express] Board server listening at ${serverConfig.hostname}`);
  });

  return { app, server, serverConfig };
}

async function createServerConfig(port: number): Promise<ServerConfig> {
  const MODULE_PATH = dirname(fileURLToPath(import.meta.url));
  const ROOT_PATH = resolve(MODULE_PATH, "../../../");

  const HOST = process.env.HOST || "localhost";
  const HOSTNAME = `http://${HOST}:${port}`;
  const IS_PROD = process.env.NODE_ENV === "production";

  return {
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
}

// If this file is run directly, start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}