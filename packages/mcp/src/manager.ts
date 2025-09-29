/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { McpClientManager } from "./client-manager.js";
import { McpFileSystemBackend } from "./mcp-fs-backend.js";
import {
  McpBuiltInClientFactory,
  McpBuiltInClientFactoryContext,
} from "./types.js";

export { McpManager };

class McpManager {
  readonly clientManager: McpClientManager;
  readonly fileSystemBackend: McpFileSystemBackend;

  constructor(
    builtInClients: [string, McpBuiltInClientFactory][],
    context: McpBuiltInClientFactoryContext,
    proxyUrl?: string
  ) {
    this.clientManager = new McpClientManager(
      builtInClients,
      context,
      proxyUrl
    );
    this.fileSystemBackend = new McpFileSystemBackend(this.clientManager);
  }
}
