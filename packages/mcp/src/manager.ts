/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TokenGetter } from "@breadboard-ai/types";
import { McpClientManager } from "./client-manager.js";
import { McpFileSystemBackend } from "./mcp-fs-backend.js";

export { McpManager };

class McpManager {
  readonly clientManager: McpClientManager;
  readonly fileSystemBackend: McpFileSystemBackend;

  constructor(tokenGetter: TokenGetter, proxyUrl?: string) {
    this.clientManager = new McpClientManager(tokenGetter, proxyUrl);
    this.fileSystemBackend = new McpFileSystemBackend(this.clientManager);
  }
}
