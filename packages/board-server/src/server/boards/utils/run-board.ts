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

  let inputsToConsume = next ? undefined : inputs;

  const resumeFrom = await fromNextToState(runStateStore, user, next);

  const state = createRunStateManager(resumeFrom, inputs);

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
      case "graphstart": {
        await writer.write(["graphstart", data.path, data.timestamp]);
        break;
      }
      case "graphend": {
        await writer.write(["graphend", data.path, data.timestamp]);
        break;
      }
      case "nodestart": {
        await writer.write(["nodestart", data.path, data.timestamp, data.node]);
        break;
      }
      case "nodeend": {
        await writer.write(["nodeend", data.path, data.timestamp, data.node]);
        break;
      }
      case "skip": {
        await writer.write(["skip", data]);
        break;
      }
      case "input": {
        if (inputsToConsume && Object.keys(inputsToConsume).length > 0) {
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
        await writer.write([
          "error",
          { error: formatRunError(data.error), timestamp: timestamp() },
        ]);
        return;
      }
      case "end": {
        if (diagnostics) {
          await writer.write(["end", data]);
        }
        return;
      }
      default: {
        console.log("Unknown type", type, data);
      }
    }
  }
  writer.write([
    "error",
    {
      error: "Run completed without signaling end or error.",
      timestamp: timestamp(),
    },
  ]);
};
