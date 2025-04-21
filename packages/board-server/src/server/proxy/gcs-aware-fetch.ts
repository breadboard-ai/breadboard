/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  callHandler,
  type InputValues,
  type Kit,
  type NodeHandlerContext,
  type OutputValues,
} from "@google-labs/breadboard";
import type { BoardServerStore, ServerInfo } from "../store.js";
import type { ServerConfig } from "../config.js";

export { GcsAwareFetch };

class GcsAwareFetch {
  static #instance: GcsAwareFetch | undefined;

  private readonly serverInfo: Promise<ServerInfo | null>;

  constructor(
    store: BoardServerStore,
    public readonly serverConfig: ServerConfig
  ) {
    this.serverInfo = store.getServerInfo();
  }

  #processFetchInputs(serverUrl: string, inputs: InputValues) {
    return inputs;
  }

  #procesFetchOutputs(serverUrl: string, outputs: OutputValues | void) {
    return outputs;
  }

  createKit(nestedKit: Kit): Kit {
    const nestedFetch = nestedKit.handlers.fetch;
    if (!nestedFetch) {
      throw new Error(`Invalid argument: unable to find "fetch" handler`);
    }

    return {
      url: "server://gcs-aware-fetch", // any URL would do
      handlers: {
        fetch: async (
          inputs: InputValues,
          context: NodeHandlerContext
        ): Promise<OutputValues | void> => {
          const serverInfo = await this.serverInfo;
          const serverUrl = serverInfo?.url || this.serverConfig.serverUrl;
          if (!serverUrl) {
            // If no server URL found at all, just do the usual fetch handler.
            return callHandler(nestedFetch, inputs, context);
          }

          // Otherwise, process inputs ...
          const updatedInputs = this.#processFetchInputs(serverUrl, inputs);

          // ... call the nested fetch ...
          const outputs = await callHandler(
            nestedFetch,
            updatedInputs,
            context
          );

          // ... and process outputs.
          const updatedOutputs = this.#procesFetchOutputs(serverUrl, outputs);

          return updatedOutputs;
        },
      },
    };
  }

  static instance(
    store: BoardServerStore,
    config: ServerConfig
  ): GcsAwareFetch {
    if (!GcsAwareFetch.#instance) {
      GcsAwareFetch.#instance = new GcsAwareFetch(store, config);
    }
    return GcsAwareFetch.#instance;
  }
}
