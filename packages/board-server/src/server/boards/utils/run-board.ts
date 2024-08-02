/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDataStore } from "@breadboard-ai/data-store";
import {
  createLoader,
  createRunStateManager,
  inflateData,
  type OutputValues,
  type ReanimationState,
} from "@google-labs/breadboard";
import { run } from "@google-labs/breadboard/harness";
import type { RunBoardArguments, RunBoardStateStore } from "../../types.js";
import { BoardServerProvider } from "./board-server-provider.js";
import { createKits } from "./create-kits.js";
import { formatRunError } from "./format-run-error.js";

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
}: RunBoardArguments): Promise<void> => {
  const store = getDataStore();
  if (!store) {
    await writer.write(["error", "Data store not available."]);
    return;
  }

  let inputsToConsume = next ? undefined : inputs;

  const resumeFrom = await fromNextToState(runStateStore, user, next);

  const state = createRunStateManager(resumeFrom, inputs);

  const diagnostics = false;

  const runner = run({
    url,
    kits: createKits(kitOverrides),
    loader: createLoader([new BoardServerProvider(path, loader)]),
    store,
    inputs: { model: "gemini-1.5-flash-latest" },
    interactiveSecrets: false,
    diagnostics,
    state,
  });

  for await (const result of runner) {
    const { type, data, reply } = result;
    switch (type) {
      case "input": {
        if (inputsToConsume) {
          await reply({ inputs: inputsToConsume });
          inputsToConsume = undefined;
          break;
        } else {
          const { inputArguments } = data;
          const reanimationState = state.lifecycle().reanimationState();
          const schema = inputArguments?.schema || {};
          const next = await fromStateToNext(
            runStateStore,
            user,
            reanimationState
          );
          await writer.write(["input", { schema, next }]);
          return;
        }
      }
      case "output": {
        const outputs = (await inflateData(
          store,
          data.outputs
        )) as OutputValues;
        await writer.write(["output", outputs]);
        break;
      }
      case "error": {
        await writer.write(["error", formatRunError(data.error)]);
        return;
      }
      case "end": {
        if (diagnostics) {
          console.log("Run completed.", data.last);
        }
        return;
      }
      default: {
        console.log("Diagnostics", type, data);
      }
    }
  }
  writer.write(["error", "Run completed without signaling end or error."]);
};
