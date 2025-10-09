/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import * as fs from "fs/promises";
import { fileURLToPath } from "url";

const PORT = Number(process.env["PORT"] || 3001);
const LIVE_RELOAD_PORT = Number(process.env["LIVE_RELOAD_PORT"] || 30012);
const DEV = process.env["DEV"] === "true";

const STATIC_DIRS = ["static", "dist/host_bundled"];

const indexHtmlPath = fileURLToPath(
  import.meta.resolve("../../static/index.html")
);

async function serveIndexHtml(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (req.path !== "/") {
    return next();
  }
  let html = await fs.readFile(indexHtmlPath, "utf-8");
  html = html.replace(
    "<!-- inject live reload -->",
    DEV
      ? `<script src="http://localhost:${LIVE_RELOAD_PORT}/livereload.js"></script>`
      : ""
  );
  res.type("html").send(html);
}

const app = express();
app.use(serveIndexHtml);
for (const dir of STATIC_DIRS) {
  app.use(express.static(dir));
}

if (DEV) {
  const livereload = await import("livereload");
  livereload.createServer({ port: LIVE_RELOAD_PORT }).watch(STATIC_DIRS);
}

app.listen(PORT, () => {
  console.log(`opal-shell-server listening on http://localhost:${PORT}`);
});
