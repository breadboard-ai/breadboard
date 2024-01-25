/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, asyncGen } from "../index.js";
import { timestamp } from "../timestamp.js";
import { BreadboardRunResult, Kit, ProbeMessage } from "../types.js";
import { Diagnostics } from "./diagnostics.js";
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
  const { type, node, timestamp } = result;
  if (type === "input") {
    const { inputArguments } = result;
    return {
      type,
      data: {
        node,
        inputArguments,
      },
      reply: async (value) => {
        result.inputs = value.inputs;
      },
    } as HarnessRunResult;
  } else if (type === "output") {
    const { outputs } = result;
    return {
      type,
      data: {
        node,
        outputs,
        timestamp,
      },
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

const errorResult = (error: string) => {
  return {
    type: "error",
    data: { error, timestamp: timestamp() },
    reply: async () => {
      // Do nothing
    },
  } as HarnessRunResult;
};

export async function* runLocally(config: RunConfig, kits: Kit[]) {
  yield* asyncGen<HarnessRunResult>(async (next) => {
    const base = baseURL(config);
    const runner = await Board.load(config.url, { base });

    try {
      const probe = config.diagnostics
        ? new Diagnostics(async (message) => {
            await next(fromProbe(message));
          })
        : undefined;

      for await (const data of runner.run({ probe, kits })) {
        await next(fromRunnerResult(data));
      }
      await next(endResult());
    } catch (e) {
      let error = e as Error;
      let message = "";
      while (error?.cause) {
        // In the event we get a cause that has no inner error, we will
        // propagate the cause instead.
        error = (error.cause as { error: Error | undefined }).error ?? {
          name: "Unexpected Error",
          message: JSON.stringify(error.cause, null, 2),
        };
        if (error && "message" in error) {
          message += `\n${error.message}`;
        }
      }
      console.error(message, error);
      await next(errorResult(message));
    }
  });
}
