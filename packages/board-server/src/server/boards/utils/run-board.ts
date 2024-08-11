/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDataStore } from "@breadboard-ai/data-store";
import { createLoader, type ReanimationState } from "@google-labs/breadboard";
import { handleRunGraphRequest } from "@google-labs/breadboard/remote";
import type { RunBoardArguments, RunBoardStateStore } from "../../types.js";
import { BoardServerProvider } from "./board-server-provider.js";
import { createKits } from "./create-kits.js";

export const timestamp = () => globalThis.performance.now();

const fromNextToState = async (
  store: RunBoardStateStore,
  user: string,
  next?: string
): Promise<ReanimationState | undefined> => {
  if (!next) {
    return undefined;
  }
  return store.loadReanimationState(user, next);
};

const fromStateToNext = async (
  store: RunBoardStateStore,
  user: string,
  state: ReanimationState
): Promise<string> => {
  return store.saveReanimationState(user, state);
};

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

  return handleRunGraphRequest(
    {
      inputs,
      next,
    },
    {
      url,
      kits: createKits(kitOverrides),
      writer,
      loader: createLoader([new BoardServerProvider(path, loader)]),
      dataStore: store,
      stateStore: {
        load(next?: string) {
          return fromNextToState(runStateStore, user, next);
        },
        save(state: ReanimationState) {
          return fromStateToNext(runStateStore, user, state);
        },
      },
      inputs: { model: "gemini-1.5-flash-latest" },
      diagnostics,
    }
  );
};
