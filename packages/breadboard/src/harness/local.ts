/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, asyncGen } from "../index.js";
import { createLoader } from "../loader/index.js";
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
import { RunConfig } from "./run.js";
import { HarnessRunResult } from "./types.js";
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

const endResult = () => {
  return {
    type: "end",
    data: { timestamp: timestamp() },
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

const load = async (config: RunConfig): Promise<BreadboardRunner> => {
  const base = baseURL(config);
  const loader = config.loader || createLoader();
  const graph = await loader.load(config.url, { base });
  if (!graph) {
    throw new Error(`Unable to load graph from "${config.url}"`);
  }
  return Board.fromGraphDescriptor(graph);
};

export async function* runLocally(config: RunConfig, kits: Kit[]) {
  yield* asyncGen<HarnessRunResult>(async (next) => {
    const runner = config.runner || (await load(config));
    const loader = config.loader || createLoader();

    try {
      const probe = config.diagnostics
        ? new Diagnostics(async (message) => {
            await next(fromProbe(message));
          })
        : undefined;

      for await (const data of runner.run({
        probe,
        kits,
        loader,
        base: config.base,
        signal: config.signal,
      })) {
        await next(fromRunnerResult(data));
      }
      await next(endResult());
    } catch (e) {
      const error = extractError(e);
      console.error("Local Run error:", error);
      await next(errorResult(error));
    }
  });
}
