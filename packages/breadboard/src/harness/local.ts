/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDefaultDataStore } from "../data/index.js";
import { asyncGen, runGraph } from "../index.js";
import { createLoader } from "../loader/index.js";
import { LastNode } from "../remote/types.js";
import type { RunStackEntry } from "../run/types.js";
import { saveRunnerState } from "../serialization.js";
import { timestamp } from "../timestamp.js";
import {
  BreadboardRunResult,
  BreadboardRunner,
  ErrorObject,
  Kit,
  ProbeMessage,
} from "../types.js";
import { Diagnostics } from "./diagnostics.js";
import { extractError } from "./error.js";
import { HarnessRunResult, RunConfig } from "./types.js";
import { baseURL } from "./url.js";

const fromProbe = <Probe extends ProbeMessage>(probe: Probe) => {
  const loadStateIfAny = () => {
    if (probe.type === "nodestart") {
      return probe.state;
    }
    return undefined;
  };
  const state = loadStateIfAny();
  const data = structuredClone(probe.data);
  return {
    type: probe.type,
    data,
    state,
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

  const saveState = async (): Promise<RunStackEntry[]> => {
    const runState = result.runState;
    if (runState) {
      return runState;
    }
    return [
      {
        url: undefined,
        path: [invocationId],
        state: saveRunnerState(type, result.state),
      },
    ];
  };

  if (type === "input") {
    const { inputArguments, path } = result;
    return {
      type,
      data: { node, inputArguments, path, bubbled, timestamp },
      reply: async (value) => {
        result.inputs = value.inputs;
      },
      saveState,
    } as HarnessRunResult;
  } else if (type === "output") {
    const { outputs, path } = result;
    return {
      type,
      data: { node, outputs, path, timestamp, bubbled },
      reply: async () => {
        // Do nothing
      },
      saveState,
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

const load = async (config: RunConfig): Promise<BreadboardRunner> => {
  const base = baseURL(config);
  const loader = config.loader || createLoader();
  const graph = await loader.load(config.url, { base });
  if (!graph) {
    throw new Error(`Unable to load graph from "${config.url}"`);
  }
  return graph;
};

export async function* runLocally(config: RunConfig, kits: Kit[]) {
  yield* asyncGen<HarnessRunResult>(async (next) => {
    const runner = config.runner || (await load(config));
    const loader = config.loader || createLoader();
    const store = config.store || createDefaultDataStore();
    const { base, signal, inputs, state } = config;

    try {
      let last: LastNode | undefined;

      const probe = config.diagnostics
        ? new Diagnostics(async (message) => {
            last = maybeSaveProbe(message, last);
            await next(fromProbe(message));
          })
        : undefined;

      for await (const data of runGraph(runner, {
        probe,
        kits,
        loader,
        store,
        base,
        signal,
        inputs,
        state,
      })) {
        last = maybeSaveResult(data, last);
        await next(fromRunnerResult(data));
      }
      await next(endResult(last));
    } catch (e) {
      const error = extractError(e);
      console.error("Local Run error:", error);
      await next(errorResult(error));
    }
  });
}
