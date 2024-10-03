/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDataStore } from "@breadboard-ai/data-store";
import { createLoader, type ReanimationState } from "@google-labs/breadboard";
import { handleRunGraphRequest } from "@google-labs/breadboard/remote";
import type { RunBoardArguments } from "../../types.js";
import { BoardServerProvider } from "./board-server-provider.js";
import { createKits } from "./create-kits.js";

export const timestamp = () => globalThis.performance.now();

export const runBoard = async ({
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

  const boardServerProvider = new BoardServerProvider(path, loader);
  await boardServerProvider.ready();

  return handleRunGraphRequest(
    {
      inputs,
      next,
      diagnostics,
    },
    {
      url,
      kits: createKits(kitOverrides),
      writer,
      loader: createLoader([boardServerProvider]),
      dataStore: store,
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
