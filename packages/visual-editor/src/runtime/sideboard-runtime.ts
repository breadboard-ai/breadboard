/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  LLMContent,
  OutputValues,
} from "@breadboard-ai/types";
import {
  createRunner,
  HarnessProxyConfig,
  HarnessRunner,
  RunConfig,
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
  Outcome,
  err,
} from "@google-labs/breadboard";
import { BoardServerAwareDataStore } from "./board-server-aware-data-store";
import {
  createFileSystemBackend,
  getDataStore,
} from "@breadboard-ai/data-store";
import { SecretsHelper } from "../utils/secrets-helper";
import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import { TokenVendor } from "@breadboard-ai/connection-client";
import { addNodeProxyServerConfig } from "../data/node-proxy-servers";
import type {
  SideBoardRuntime,
  SideBoardRuntimeEventTarget,
  SideBoardRuntimeTaskSpec,
} from "@breadboard-ai/shared-ui/sideboards/types.js";

export { createSideboardRuntimeProvider };

const EVENT_DICT = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

function createSideboardRuntimeProvider(
  args: GraphStoreArgs,
  servers: BoardServer[],
  tokenVendor: TokenVendor,
  settings: SettingsStore,
  proxy?: HarnessProxyConfig[]
): SideboardRuntimeProvider {
  return {
    createSideboardRuntime() {
      return new SideboardRuntimeImpl(
        args,
        servers,
        tokenVendor!,
        settings,
        proxy
      );
    },
  };
}

class SideboardRuntimeImpl
  extends (EventTarget as SideBoardRuntimeEventTarget)
  implements SideBoardRuntime
{
  #graphStore: MutableGraphStore;
  #dataStore: DataStore;
  #secretsHelper: SecretsHelper | undefined;
  #fileSystem: FileSystem;
  #runningTaskCount = 0;

  constructor(
    args: GraphStoreArgs,
    private readonly servers: BoardServer[],
    public readonly tokenVendor: TokenVendor,
    public readonly settings: SettingsStore,
    private readonly proxy?: HarnessProxyConfig[]
  ) {
    super();
    this.#graphStore = createGraphStore(args);
    this.#dataStore = new BoardServerAwareDataStore(getDataStore(), servers);
    this.#fileSystem = createFileSystem({
      local: createFileSystemBackend(createEphemeralBlobStore()),
    });
  }

  async runTask(
    task: SideBoardRuntimeTaskSpec
  ): Promise<Outcome<LLMContent[]>> {
    if (this.#runningTaskCount === 0) {
      this.dispatchEvent(new Event("running", { ...EVENT_DICT }));
    }
    this.#runningTaskCount++;
    const runner = await this.createRunner(task.graph);
    const inputs = {
      context: task.context,
    } as InputValues;
    try {
      const outputs = await new Promise<OutputValues[]>((resolve, reject) => {
        const outputs: OutputValues[] = [];
        runner.addEventListener("input", () => void runner.run(inputs));
        runner.addEventListener("output", (event) =>
          outputs.push(event.data.outputs)
        );
        runner.addEventListener("end", () => resolve(outputs));
        runner.addEventListener("error", (event) => reject(event.data.error));
        void runner.run();
      });
      if (outputs.length !== 1) {
        return err(`Expected 1 output, got ${JSON.stringify(outputs)}`);
      }

      const result = outputs[0].context as LLMContent[];
      if (!result) return err(`Task returned invalid output`);

      return result;
    } catch (e) {
      return err(`Task returned with error: ${(e as Error).message}`);
    } finally {
      this.#runningTaskCount--;
      if (this.#runningTaskCount === 0) {
        this.dispatchEvent(new Event("empty", { ...EVENT_DICT }));
      }
    }
  }

  async #getProxyURL(urlString: string): Promise<string | null> {
    const url = new URL(urlString, window.location.href);
    for (const boardServer of this.servers) {
      const proxyURL = await boardServer.canProxy?.(url);
      if (proxyURL) {
        return proxyURL;
      }
    }
    return null;
  }

  async createRunner(
    graph: GraphDescriptor,
    graphURLForProxy?: string
  ): Promise<HarnessRunner> {
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

    let config: RunConfig = {
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

    if (this.proxy) {
      config = addNodeProxyServerConfig(
        this.proxy,
        config,
        this.settings,
        undefined,
        await this.#getProxyURL(graphURLForProxy ?? graph.url)
      );
    }

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
