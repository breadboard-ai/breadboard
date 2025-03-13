/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer, createServerConfig } from "./server.js";

const config = createServerConfig();
const server = createServer(config);

server.listen(config.port);
