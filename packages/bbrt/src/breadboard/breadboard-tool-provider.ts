/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ArtifactStore } from "../artifacts/artifact-store-interface.js";
import type { SecretsProvider } from "../secrets/secrets-provider.js";
import type { ToolProvider } from "../tools/tool-provider.js";
import type { BBRTTool } from "../tools/tool.js";
import type { BreadboardServer } from "./breadboard-server.js";
import { BreadboardTool } from "./breadboard-tool.js";

export class BreadboardToolProvider implements ToolProvider {
  readonly #server: BreadboardServer;
  readonly #secrets: SecretsProvider;
  readonly #artifactStore: ArtifactStore;

  constructor(
    server: BreadboardServer,
    secrets: SecretsProvider,
    artifactStore: ArtifactStore
  ) {
    this.#server = server;
    this.#secrets = secrets;
    this.#artifactStore = artifactStore;
  }

  get name() {
    return new URL(this.#server.url).host;
  }

  async tools(): Promise<BBRTTool[]> {
    const boards = await this.#server.boards();
    if (!boards.ok) {
      console.error(
        `Failed to fetch boards from ${this.#server.url}: ${boards.error}`
      );
      return [];
    }
    return boards.value.map(
      (board) =>
        new BreadboardTool(
          board,
          this.#server,
          this.#secrets,
          this.#artifactStore
        )
    );
  }
}
