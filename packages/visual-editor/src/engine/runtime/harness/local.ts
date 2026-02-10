/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProbeMessage } from "@breadboard-ai/types";
import { HarnessRunResult } from "@breadboard-ai/types";

export { fromProbe };

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
