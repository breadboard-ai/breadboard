/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDataStore } from "@breadboard-ai/data-store";
import {
  createGraphStore,
  createLoader,
  StubFileSystem,
  type ReanimationState,
} from "@google-labs/breadboard";
import { handleRunGraphRequest } from "@breadboard-ai/runtime/legacy.js";
import type { RunBoardArguments } from "../../types.js";
import { BoardServerProvider } from "./board-server-provider.js";
import { createKits, registerLegacyKits } from "./create-kits.js";
import { NodeSandbox } from "@breadboard-ai/jsandbox/node";

export const timestamp = () => globalThis.performance.now();

export const runBoard = async ({
  serverUrl,
  url,
  path,
  user,
  inputs,
  loader,
  kitOverrides,
  next,
  writer,
  runStateStore,
  diagnostics = false,
}: RunBoardArguments): Promise<void> => {
  const store = getDataStore();
  if (!store) {
    await writer.write([
      "error",
      { error: "Data store not available.", timestamp: timestamp() },
    ]);
    return;
  }
  // TODO: Figure out if this is the right thing to do here.
  store.createGroup("run-board");

  const boardServerProvider = new BoardServerProvider(serverUrl, path, loader);
  await boardServerProvider.ready();

  const runLoader = createLoader([boardServerProvider]);
  const runKits = createKits(kitOverrides);
  const graphStore = createGraphStore({
    loader: runLoader,
    kits: runKits,
    sandbox: {
      createRunnableModule() {
        throw new Error("Not implemented");
      },
    },
    fileSystem: new StubFileSystem(),
  });

  registerLegacyKits(graphStore);

  return handleRunGraphRequest(
    {
      inputs,
      next,
      diagnostics,
    },
    {
      url,
      kits: runKits,
      writer,
      loader: runLoader,
      dataStore: store,
      graphStore,
      stateStore: {
        async load(next?: string) {
          if (!next) {
            return undefined;
          }
          return runStateStore.loadReanimationState(user, next);
        },
        async save(state: ReanimationState) {
          return runStateStore.saveReanimationState(user, state);
        },
      },
      inputs: { model: "gemini-1.5-flash-latest" },
      diagnostics,
    }
  );
};
