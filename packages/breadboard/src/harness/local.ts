/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProbeMessage } from "@breadboard-ai/types";
import { createDefaultDataStore } from "../data/index.js";
import { asyncGen, runGraph } from "../index.js";
import { createLoader } from "../loader/index.js";
import { LastNode } from "../remote/types.js";
import { timestamp } from "../timestamp.js";
import { BreadboardRunResult, ErrorObject, GraphToRun, Kit } from "../types.js";
import { Diagnostics } from "./diagnostics.js";
import { extractError } from "./error.js";
import { HarnessRunResult, RunConfig } from "./types.js";
import { baseURL } from "./url.js";

const fromProbe = <Probe extends ProbeMessage>(probe: Probe) => {
  const data = structuredClone(probe.data);
  return {
    type: probe.type,
    data,
    result: probe.type === "nodestart" ? probe.result : undefined,
    reply: async () => {
      // Do nothing
    },
  } as HarnessRunResult;
};

const fromRunnerResult = <Result extends BreadboardRunResult>(
  result: Result
) => {
  const { type, node, timestamp, invocationId } = result;
  const bubbled = invocationId == -1;

  if (type === "input") {
    const { inputArguments, path } = result;
    return {
      type,
      data: { node, inputArguments, path, bubbled, timestamp },
      reply: async (value) => {
        result.inputs = value.inputs;
      },
    } as HarnessRunResult;
  } else if (type === "output") {
    const { outputs, path } = result;
    return {
      type,
      data: { node, outputs, path, timestamp, bubbled },
      reply: async () => {
        // Do nothing
      },
    } as HarnessRunResult;
  }
  throw new Error(`Unknown result type "${type}".`);
};

const endResult = (last: LastNode | undefined) => {
  return {
    type: "end",
    data: { timestamp: timestamp(), last },
    reply: async () => {
      // Do nothing
    },
  } as HarnessRunResult;
};

const errorResult = (error: string | ErrorObject) => {
  return {
    type: "error",
    data: { error, timestamp: timestamp() },
    reply: async () => {
      // Do nothing
    },
  } as HarnessRunResult;
};

const maybeSaveProbe = (
  result: ProbeMessage,
  last?: LastNode
): LastNode | undefined => {
  const { type, data } = result;
  if (type === "skip") {
    return {
      node: data.node,
      missing: data.missingInputs,
    };
  }
  return last;
};

const maybeSaveResult = (result: BreadboardRunResult, last?: LastNode) => {
  const { type, node } = result;
  if (type === "output" || type === "input") {
    return {
      node,
      missing: [],
    };
  }
  return last;
};

const load = async (config: RunConfig): Promise<GraphToRun> => {
  const base = baseURL(config);
  const loader = config.loader || createLoader();
  const loadResult = await loader.load(config.url, { base });
  if (!loadResult.success) {
    throw new Error(
      `Unable to load graph from "${config.url}": ${loadResult.error}`
    );
  }
  return loadResult;
};

export async function* runLocally(config: RunConfig, kits: Kit[]) {
  yield* asyncGen<HarnessRunResult>(async (next) => {
    const graphToRun: GraphToRun = config.runner
      ? { graph: config.runner }
      : await load(config);
    const loader = config.loader || createLoader();
    const store = config.store || createDefaultDataStore();
    const fileSystem = config.fileSystem;
    const { base, signal, inputs, state, start, stopAfter, graphStore } =
      config;

    try {
      let last: LastNode | undefined;

      const probe =
        config.diagnostics === true || config.diagnostics === "top"
          ? new Diagnostics(async (message) => {
              last = maybeSaveProbe(message, last);
              await next(fromProbe(message));
            })
          : undefined;

      for await (const data of runGraph(graphToRun, {
        probe,
        kits,
        loader,
        store,
        fileSystem,
        base,
        signal,
        inputs,
        state,
        start,
        stopAfter,
        graphStore,
      })) {
        last = maybeSaveResult(data, last);
        await next(fromRunnerResult(data));
      }
      await next(endResult(last));
    } catch (e) {
      const error = extractError(e);
      if (config.diagnostics !== "silent") {
        console.error("Local Run error:", error);
      }
      await next(errorResult(error));
    }
  });
}
