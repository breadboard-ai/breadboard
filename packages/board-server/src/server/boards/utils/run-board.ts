/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDataStore } from "@breadboard-ai/data-store";
import { run, type StateToResumeFrom } from "@google-labs/breadboard/harness";
import { createKits } from "./create-kits.js";
import {
  createLoader,
  inflateData,
  type InputValues,
} from "@google-labs/breadboard";
import { BoardServerProvider } from "./board-server-provider.js";
import { formatRunError } from "./format-run-error.js";
import type { RunBoardArguments, RunBoardResult } from "../../types.js";

const fromNextToState = (
  next?: string,
  inputs?: InputValues
): StateToResumeFrom => {
  const state = next ? JSON.parse(next) : undefined;
  return {
    state,
    inputs,
  };
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

  let inputsToConsume = inputs;

  const runner = run({
    url,
    kits: createKits(kitOverrides),
    loader: createLoader([new BoardServerProvider(path, loader)]),
    store,
    inputs: { model: "gemini-1.5-flash-latest" },
    interactiveSecrets: false,
    resumeFrom: fromNextToState(next, inputs),
  });

  for await (const result of runner) {
    const { type, data, reply } = result;
    if (type === "input") {
      if (inputsToConsume) {
        await reply({ inputs: inputsToConsume });
        inputsToConsume = undefined;
      } else {
        const schema = data.node.configuration?.schema || {};
        const state = await result.saveState?.();
        if (!state) {
          return {
            $error: "No state supplied, internal run error.",
          };
        }
        const next = fromStateToNext(state);
        return {
          $state: { type, schema, next },
        };
      }
    } else if (type === "output") {
      const schema = data.node.configuration?.schema || {};
      const state = await result.saveState?.();
      if (!state) {
        return {
          $error: "No state supplied, internal run error.",
        };
      }
      const next = fromStateToNext(state);
      return {
        $state: { type, schema, next },
        ...((await inflateData(store, data.outputs)) as RunBoardResult),
      };
    } else if (type === "error") {
      return {
        $error: formatRunError(data.error),
      };
    } else if (type === "end") {
      return { $state: { type } };
    } else {
      console.log("UNKNOWN RESULT", type, data);
    }
  }
  return {
    $error: "Run completed without signaling end or error.",
  };
};
