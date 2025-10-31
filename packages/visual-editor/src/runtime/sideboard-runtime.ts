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
  BoardServer,
} from "@breadboard-ai/types";
import type { HarnessRunner, RunConfig } from "@breadboard-ai/types";
import { createRunner, RunnerErrorEvent } from "@breadboard-ai/runtime";
import { RuntimeConfig, SideboardRuntimeProvider } from "./types";
import {
  createEphemeralBlobStore,
  createFileSystem,
  createGraphStore,
  GraphStoreArgs,
  MutableGraphStore,
  FileSystem,
  Outcome,
  err,
  NodeDescriberResult,
  ErrorObject,
  composeFileSystemBackends,
} from "@google-labs/breadboard";
import {
  createFileSystemBackend,
  getDataStore,
} from "@breadboard-ai/data-store";
import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import type {
  SideBoardRuntime,
  SideBoardRuntimeEventTarget,
  SideBoardRuntimeTaskSpec,
} from "@breadboard-ai/shared-ui/sideboards/types.js";
import { BoardServerAwareDataStore } from "@breadboard-ai/board-server-management";
import { formatError } from "@breadboard-ai/shared-ui/utils/format-error.js";
import {
  assetsFromGraphDescriptor,
  envFromGraphDescriptor,
} from "@breadboard-ai/data";

export { createSideboardRuntimeProvider };

const EVENT_DICT = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

function createSideboardRuntimeProvider(
  args: GraphStoreArgs,
  servers: BoardServer[],
  config: RuntimeConfig
): SideboardRuntimeProvider {
  return {
    createSideboardRuntime() {
      return new SideboardRuntimeImpl(
        args,
        servers,
        config.settings,
        config.fileSystem,
        config.fetchWithCreds
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
  #fileSystem: FileSystem;
  #runningTaskCount = 0;
  #discardTasks = false;

  constructor(
    args: GraphStoreArgs,
    servers: BoardServer[],
    public readonly settings: SettingsStore,
    fileSystem: FileSystem | undefined,
    private readonly fetchWithCreds: typeof globalThis.fetch
  ) {
    super();
    this.#dataStore = new BoardServerAwareDataStore(
      getDataStore(),
      servers,
      undefined
    );
    this.#dataStore.createGroup("sideboard");
    this.#fileSystem = createFileSystem({
      env: fileSystem?.env() || [],
      local: createFileSystemBackend(createEphemeralBlobStore()),
      mnt: composeFileSystemBackends(new Map()),
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
      const outputs = (
        await new Promise<OutputValues[]>((resolve, reject) => {
          const outputs: OutputValues[] = [];
          runner.addEventListener("input", () => void runner.run(inputs));
          runner.addEventListener("output", (event) =>
            outputs.push(event.data.outputs)
          );
          runner.addEventListener("end", () => resolve(outputs));
          runner.addEventListener("error", (event) => reject(event.data.error));
          void runner.run();
        })
      ).filter((item) => "context" in item);
      if (outputs.length !== 1) {
        return err(`Expected 1 output, got ${JSON.stringify(outputs)}`);
      }

      if (this.#discardTasks) return err(`Tasks were discarded`);

      const result = outputs[0].context as LLMContent[];
      if (!result) return err(`Task returned invalid output`);

      return result;
    } catch (e) {
      return err(`Task returned with error: ${formatError(e as ErrorObject)}`);
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

  async createConfig(
    graph: GraphDescriptor | string,
    _graphURLForProxy?: string,
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
    const config: RunConfig = {
      url,
      diagnostics: "silent",
      kits: [...this.#graphStore.kits],
      loader: this.#graphStore.loader,
      store: this.#dataStore.createRunDataStore(url),
      graphStore: this.#graphStore,
      fileSystem: this.#fileSystem.createRunFileSystem({
        graphUrl: url,
        env: envFromGraphDescriptor(this.#fileSystem.env(), graph),
        assets: assetsFromGraphDescriptor(graph),
      }),
      interactiveSecrets: true,
      signal,
      fetchWithCreds: this.fetchWithCreds,
    };

    if (!loadGraph) {
      config.runner = graph;
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
    runner.addEventListener("secret", () =>
      runner.dispatchEvent(
        new RunnerErrorEvent({
          error: `Secrets are not supported`,
          timestamp: Date.now(),
        })
      )
    );
    return runner;
  }
}
