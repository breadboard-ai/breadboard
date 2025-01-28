import express from "express";
import ViteExpress from "vite-express";

import { createServer } from "@breadboard-ai/connection-server/server.js";
import { makeRouter } from "@breadboard-ai/board-server/router";

const app = express();

app.use(
  "/connection",
  createServer({
    connections: new Map(),
    allowedOrigins: [],
  })
);

app.use(
  "/board",
  makeRouter({
    allowedOrigins: new Set(),
    hostname: "",
    serverUrl: "",
    viteDevServer: null,
    rootPath: "",
    storageBucket: "",
  })
);

ViteExpress.listen(app, 3000, () => {
  console.log("Server is listening on port 3000");
});
