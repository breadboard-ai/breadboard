/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDefaultDataStore } from "@breadboard-ai/data";
import type { ProbeMessage } from "@breadboard-ai/types";
import {
  BreadboardRunResult,
  ErrorObject,
  GraphToRun,
  HarnessRunResult,
  Kit,
  LastNode,
  RunConfig,
} from "@breadboard-ai/types";
import { asyncGen, timestamp } from "@breadboard-ai/utils";
import { runGraph } from "../run/run-graph.js";
import { Diagnostics } from "./diagnostics.js";
import { extractError } from "./error.js";
import { baseURL } from "./url.js";

export { graphToRunFromConfig, runLocally, fromRunnerResult, fromProbe };

function fromProbe<Probe extends ProbeMessage>(probe: Probe) {
  const data = structuredClone(probe.data);
  return {
    type: probe.type,
    data,
    result: probe.type === "nodestart" ? probe.result : undefined,
    reply: async () => {
      // Do nothing
    },
  } as HarnessRunResult;
}

function fromRunnerResult<Result extends BreadboardRunResult>(result: Result) {
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
}

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

async function graphToRunFromConfig(config: RunConfig): Promise<GraphToRun> {
  if (config.runner) {
    return { graph: config.runner };
  }
  const base = baseURL(config);
  const loader = config.loader; // || createLoader();
  if (!loader) {
    throw new Error(
      `Unable to load graph from "${config.url}": Loader not supplied`
    );
  }
  const loadResult = await loader.load(config.url, { base });
  if (!loadResult.success) {
    throw new Error(
      `Unable to load graph from "${config.url}": ${loadResult.error}`
    );
  }
  return loadResult;
}

async function* runLocally(config: RunConfig, kits: Kit[]) {
  yield* asyncGen<HarnessRunResult>(async (next) => {
    const graphToRun: GraphToRun = await graphToRunFromConfig(config);
    const loader = config.loader; // || createLoader();
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
