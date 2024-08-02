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
import type { RunBoardArguments, RunBoardResult } from "../../types.js";
import { BoardServerProvider } from "./board-server-provider.js";
import { createKits } from "./create-kits.js";
import { formatRunError } from "./format-run-error.js";

const fromNextToState = (next?: string): ReanimationState | undefined => {
  return next ? JSON.parse(next) : undefined;
};

const fromStateToNext = (state: any) => {
  return JSON.stringify(state);
};

export const runBoard = async ({
  url,
  path,
  inputs,
  loader,
  kitOverrides,
  next,
}: RunBoardArguments): Promise<RunBoardResult> => {
  const store = getDataStore();
  if (!store) {
    return { $error: "Data store not available." };
  }

  let inputsToConsume = next ? undefined : inputs;

  const resumeFrom = fromNextToState(next);

  const state = createRunStateManager(resumeFrom, inputs);

  const runner = run({
    url,
    kits: createKits(kitOverrides),
    loader: createLoader([new BoardServerProvider(path, loader)]),
    store,
    inputs: { model: "gemini-1.5-flash-latest" },
    interactiveSecrets: false,
    state,
  });

  const outputs: OutputValues[] = [];
  for await (const result of runner) {
    const { type, data, reply } = result;
    if (type === "input") {
      if (inputsToConsume) {
        await reply({ inputs: inputsToConsume });
        inputsToConsume = undefined;
      } else {
        const { inputArguments } = data;
        const reanimationState = state.lifecycle().reanimationState();
        const schema = inputArguments?.schema || {};
        const next = fromStateToNext(reanimationState);
        return {
          outputs,
          $state: { type, schema, next },
        };
      }
    } else if (type === "output") {
      outputs.push((await inflateData(store, data.outputs)) as OutputValues);
    } else if (type === "error") {
      return {
        outputs,
        $error: formatRunError(data.error),
      };
    } else if (type === "end") {
      return { outputs, $state: { type } };
    } else {
      console.log("UNKNOWN RESULT", type, data);
    }
  }
  return {
    $error: "Run completed without signaling end or error.",
  };
};
