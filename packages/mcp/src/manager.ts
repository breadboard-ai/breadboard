/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TokenGetter } from "@breadboard-ai/types";
import { McpClientManager } from "./client-manager.js";
import { McpFileSystemBackend } from "./mcp-fs-backend.js";
import { McpBuiltInClientFactory } from "./types.js";

export { McpManager };

class McpManager {
  readonly clientManager: McpClientManager;
  readonly fileSystemBackend: McpFileSystemBackend;

  constructor(
    builtInClients: [string, McpBuiltInClientFactory][],
    tokenGetter: TokenGetter,
    proxyUrl?: string
  ) {
    this.clientManager = new McpClientManager(
      builtInClients,
      tokenGetter,
      proxyUrl
    );
    this.fileSystemBackend = new McpFileSystemBackend(this.clientManager);
  }
}
