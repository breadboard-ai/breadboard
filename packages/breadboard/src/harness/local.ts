/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, asyncGen } from "../index.js";
import { loadRunnerState } from "../serialization.js";
import { BreadboardRunResult, Kit, ProbeMessage } from "../types.js";
import { Diagnostics } from "./diagnostics.js";
import { RunConfig } from "./run.js";
import { HarnessRunResult } from "./types.js";

const fromProbe = <Probe extends ProbeMessage>(probe: Probe) => {
  const loadStateIfAny = () => {
    if (probe.type === "nodestart") {
      return loadRunnerState(probe.data.state as string).state;
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
  const { type, node } = result;
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
    data: {},
    reply: async () => {
      // Do nothing
    },
  } as HarnessRunResult;
};

const errorResult = (error: string) => {
  return {
    type: "error",
    data: { error },
    reply: async () => {
      // Do nothing
    },
  } as HarnessRunResult;
};

export async function* runLocally(config: RunConfig, kits: Kit[]) {
  yield* asyncGen<HarnessRunResult>(async (next) => {
    const runner = await Board.load(config.url);

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
        error = (error.cause as { error: Error }).error;
        message += `\n${error.message}`;
      }
      console.error(message, error);
      await next(errorResult(message));
    }
  });
}
