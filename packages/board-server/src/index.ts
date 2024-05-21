/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from "http";
import { env } from "process";

const PORT = env.PORT || 3000;
const HOST = env.HOST || "localhost";

const server = createServer(async (req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Hello, world!");
});

server.listen(PORT, () => {
  console.info(`Running on "http://${HOST}:${PORT}"...`);
});
