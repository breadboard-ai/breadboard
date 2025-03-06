/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SideBoardRuntime } from "@breadboard-ai/shared-ui/utils/side-board-runtime.js";
import { GraphDescriptor } from "@breadboard-ai/types";
import {
  createRunner,
  HarnessRunner,
  RunnerErrorEvent,
} from "@google-labs/breadboard/harness";
import { SideboardRuntimeProvider } from "./types";
import {
  assetsFromGraphDescriptor,
  BoardServer,
  createEphemeralBlobStore,
  createFileSystem,
  createGraphStore,
  DataStore,
  GraphStoreArgs,
  MutableGraphStore,
  FileSystem,
} from "@google-labs/breadboard";
import { BoardServerAwareDataStore } from "./board-server-aware-data-store";
import {
  createFileSystemBackend,
  getDataStore,
} from "@breadboard-ai/data-store";
import { SecretsHelper } from "../utils/secrets-helper";
import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import { TokenVendor } from "@breadboard-ai/connection-client";

export { createSideboardRuntimeProvider };

function createSideboardRuntimeProvider(
  args: GraphStoreArgs,
  servers: BoardServer[],
  tokenVendor: TokenVendor,
  settings: SettingsStore
): SideboardRuntimeProvider {
  return {
    createSideboardRuntime() {
      return new SideboardRuntimeImpl(args, servers, tokenVendor!, settings);
    },
  };
}

class SideboardRuntimeImpl implements SideBoardRuntime {
  #graphStore: MutableGraphStore;
  #dataStore: DataStore;
  #secretsHelper: SecretsHelper | undefined;
  #fileSystem: FileSystem;

  constructor(
    args: GraphStoreArgs,
    servers: BoardServer[],
    public readonly tokenVendor: TokenVendor,
    public readonly settings: SettingsStore
  ) {
    this.#graphStore = createGraphStore(args);
    this.#dataStore = new BoardServerAwareDataStore(getDataStore(), servers);
    this.#fileSystem = createFileSystem({
      local: createFileSystemBackend(createEphemeralBlobStore()),
    });
  }

  async createRunner(graph: GraphDescriptor): Promise<HarnessRunner> {
    if (!graph.url) {
      // Side-boards often won't have the required `url` property,
      // because they might have been imported e.g. via the JS import
      // graph, instead of via a board loader (note that board loaders
      // inject `url` into the graphs they load). In this case, an
      // arbitrary one will be fine, as long as the board doesn't need
      // to load any other boards via non-self relative URLs.
      graph = { ...graph };
      graph.url = `file://sideboard/${crypto.randomUUID()}`;
    }
    this.#graphStore.addByDescriptor(graph);
    const config = {
      url: graph.url,
      runner: graph,
      diagnostics: true,
      kits: [...this.#graphStore.kits],
      loader: this.#graphStore.loader,
      store: this.#dataStore,
      graphStore: this.#graphStore,
      fileSystem: this.#fileSystem.createRunFileSystem({
        graphUrl: graph.url,
        env: [],
        assets: assetsFromGraphDescriptor(graph),
      }),
      interactiveSecrets: true,
    };
    const runner = createRunner(config);
    runner.addEventListener("secret", async (event) => {
      const { keys } = event.data;
      if (!this.#secretsHelper) {
        this.#secretsHelper = new SecretsHelper(this.settings);
        this.#secretsHelper.restoreStoredSecretsForKeys(keys);
      }

      if (this.#secretsHelper) {
        this.#secretsHelper.setKeys(keys);
        if (this.#secretsHelper.hasAllSecrets()) {
          runner.run(this.#secretsHelper.getSecrets());
          return;
        }
      }

      // TODO(aomarks) The logic in this.#handleSecretEvent does not
      // seem to support connections, which we definitely need. There
      // must be some other way that secrets are fulfilled when using
      // the main editor view. For now, let's just talk to token vendor
      // directly, ourselves.
      const secrets: Record<string, string> = {};
      for (const key of event.data.keys) {
        if (key.startsWith("connection:")) {
          const connectionId = key.slice("connection:".length);
          const result = this.tokenVendor.getToken(connectionId);
          if (result.state === "valid") {
            secrets[key] = result.grant.access_token;
          } else if (result.state === "expired") {
            try {
              secrets[key] = (await result.refresh()).grant.access_token;
            } catch (error) {
              runner.dispatchEvent(
                new RunnerErrorEvent({
                  error:
                    `Error refreshing access token for ` +
                    `${connectionId}: ${error}`,
                  timestamp: Date.now(),
                })
              );
            }
          } else {
            result.state satisfies "signedout";
            runner.dispatchEvent(
              new RunnerErrorEvent({
                error: `User is signed out of ${connectionId}.`,
                timestamp: Date.now(),
              })
            );
          }
        }
      }

      runner.run(secrets);
    });
    return runner;
  }
}
