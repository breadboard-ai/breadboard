/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BreadboardRunResult, ProbeMessage } from "../types.js";
import { HarnessRunResult } from "./types.js";

// import { AnyRunResult } from "./types.js";

// export class LocalResult<R extends AnyRunResult> implements HarnessResult<R> {
//   message: R;
//   response?: unknown;

//   constructor(message: R) {
//     this.message = message;
//   }

//   reply(reply: unknown) {
//     this.response = reply;
//   }
// }

export const fromProbe = <Probe extends ProbeMessage>(probe: Probe) => {
  return {
    type: probe.type,
    data: probe.data,
    reply: async () => {
      // Do nothing
    },
  } as HarnessRunResult;
};

export const fromRunnerResult = <Result extends BreadboardRunResult>(
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
        result.inputs = value;
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

export const endResult = () => {
  return {
    type: "end",
    data: {},
    reply: async () => {
      // Do nothing
    },
  } as HarnessRunResult;
};

export const errorResult = (error: string) => {
  return {
    type: "error",
    data: { error },
    reply: async () => {
      // Do nothing
    },
  } as HarnessRunResult;
};
