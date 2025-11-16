/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProbeMessage } from "@breadboard-ai/types";
import { BreadboardRunResult, HarnessRunResult } from "@breadboard-ai/types";

export { fromRunnerResult, fromProbe };

function fromProbe<Probe extends ProbeMessage>(probe: Probe) {
  const data = structuredClone(probe.data);
  return {
    type: probe.type,
    data,
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
