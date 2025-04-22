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
  GraphStoreArgs,
  MutableGraphStore,
  FileSystem,
  Outcome,
  err,
  NodeDescriberResult,
  envFromGraphDescriptor,
} from "@google-labs/breadboard";
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
import { BoardServerAwareDataStore } from "@breadboard-ai/board-server-management";

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
  #dataStore: BoardServerAwareDataStore;
  #secretsHelper: SecretsHelper | undefined;
  #fileSystem: FileSystem;
  #runningTaskCount = 0;
  #discardTasks = false;

  constructor(
    args: GraphStoreArgs,
    private readonly servers: BoardServer[],
    public readonly tokenVendor: TokenVendor,
    public readonly settings: SettingsStore,
    private readonly proxy?: HarnessProxyConfig[]
  ) {
    super();
    this.#dataStore = new BoardServerAwareDataStore(
      getDataStore(),
      servers,
      undefined
    );
    this.#dataStore.createGroup("sideboard");
    this.#fileSystem = createFileSystem({
      env: [],
      local: createFileSystemBackend(createEphemeralBlobStore()),
    });
    this.#graphStore = createGraphStore({
      ...args,
      fileSystem: this.#fileSystem,
    });
  }

  async runTask(
    task: SideBoardRuntimeTaskSpec
  ): Promise<Outcome<LLMContent[]>> {
    this.#discardTasks = false;
    if (this.#runningTaskCount === 0) {
      this.dispatchEvent(new Event("running", { ...EVENT_DICT }));
    }
    this.#runningTaskCount++;
    const runner = await this.createRunner(task.graph, task.url, task.signal);
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

      if (this.#discardTasks) return err(`Tasks were discarded`);

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

  discardTasks(): void {
    this.#discardTasks = true;
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

  async createConfig(
    graph: GraphDescriptor | string,
    graphURLForProxy?: string,
    signal?: AbortSignal
  ): Promise<RunConfig> {
    let loadGraph = false;
    let url;
    if (typeof graph === "string") {
      // This is a URL to the graph, rather than the GraphDescriptor.
      // Let's load it first.
      const added = this.#graphStore.addByURL(graph, [], {});
      url = graph;
      graph = (await this.#graphStore.getLatest(added.mutable)).graph;
      loadGraph = true;
    } else {
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
      url = graph.url!;
    }
    let config: RunConfig = {
      url,
      diagnostics: "silent",
      kits: [...this.#graphStore.kits],
      loader: this.#graphStore.loader,
      store: this.#dataStore.createRunDataStore(url),
      graphStore: this.#graphStore,
      fileSystem: this.#fileSystem.createRunFileSystem({
        graphUrl: url,
        env: envFromGraphDescriptor([], graph),
        assets: assetsFromGraphDescriptor(graph),
      }),
      interactiveSecrets: true,
      signal,
    };

    if (!loadGraph) {
      config.runner = graph;
    }

    if (this.proxy) {
      config = addNodeProxyServerConfig(
        this.proxy,
        config,
        this.settings,
        undefined,
        await this.#getProxyURL(graphURLForProxy ?? url)
      );
    }
    return config;
  }

  async describe(
    url: string,
    graphURLForProxy?: string
  ): Promise<Outcome<NodeDescriberResult>> {
    const config = await this.createConfig(url, graphURLForProxy);
    const { mutable } = config.graphStore!.addByURL(url, [], {}) || {};

    const inspectable = config.graphStore!.inspect(mutable.id, "");
    return inspectable!.describe({}, config);
  }

  async createRunner(
    graph: GraphDescriptor | string,
    graphURLForProxy?: string,
    signal?: AbortSignal
  ): Promise<HarnessRunner> {
    const config = await this.createConfig(graph, graphURLForProxy, signal);

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
