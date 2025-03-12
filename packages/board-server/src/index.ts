/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { createServer, createServerConfig } from "./server.js";

const MODULE_PATH = dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = resolve(MODULE_PATH, "../../");

try {
  const config = createServerConfig(ROOT_PATH);
  const server = createServer(config);

  server.listen(config.port);
} catch (err) {
  console.error("Failed to start the server", err);
  process.exit(1);
}
