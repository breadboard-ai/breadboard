/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServerRunConfig, ServerRunRequest } from "./types.js";
import { run } from "../harness/run.js";
import { OutputValues } from "../types.js";
import { timestamp } from "../timestamp.js";
import { createRunStateManager } from "../run/index.js";
import { inflateData } from "../data/inflate-deflate.js";
import { formatRunError } from "../harness/error.js";

export const handleRunGraphRequest = async (
  request: ServerRunRequest,
  config: ServerRunConfig
): Promise<void> => {
  const {
    url,
    kits,
    writer,
    loader,
    dataStore,
    stateStore,
    inputs: defaultInputs,
    diagnostics,
  } = config;
  const { next, inputs } = request;

  let inputsToConsume = next ? undefined : inputs;

  const resumeFrom = await stateStore?.load(next);

  const state = createRunStateManager(resumeFrom, inputs);

  const runner = run({
    url,
    kits,
    loader,
    store: dataStore,
    inputs: defaultInputs,
    interactiveSecrets: false,
    diagnostics,
    state,
  });

  for await (const result of runner) {
    const { type, data, reply } = result;
    switch (type) {
      case "graphstart": {
        await writer.write(["graphstart", data]);
        break;
      }
      case "graphend": {
        await writer.write(["graphend", data]);
        break;
      }
      case "nodestart": {
        await writer.write(["nodestart", data]);
        break;
      }
      case "nodeend": {
        await writer.write(["nodeend", data]);
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
          const reanimationState = state.lifecycle().reanimationState();
          const next = await stateStore.save(reanimationState);
          await writer.write(["input", data, next]);
          return;
        }
      }
      case "output": {
        const outputs = (await inflateData(
          dataStore,
          data.outputs
        )) as OutputValues;
        await writer.write(["output", { ...data, outputs }]);
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
