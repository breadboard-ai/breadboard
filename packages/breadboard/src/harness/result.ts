/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadRunnerState } from "../serialization.js";
import { BreadboardRunResult, ProbeMessage } from "../types.js";
import { HarnessRunResult } from "./types.js";

export const fromProbe = <Probe extends ProbeMessage>(probe: Probe) => {
  const loadStateIfAny = () => {
    if (probe.type === "nodestart") {
      return loadRunnerState(probe.data.state as string).state;
    }
    return undefined;
  };
  const state = loadStateIfAny();
  return {
    type: probe.type,
    data: probe.data,
    state,
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
