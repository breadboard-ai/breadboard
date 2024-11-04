/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Probe } from "@breadboard-ai/types";

export { Telemetry };

class Telemetry {
  constructor(public readonly probe: Probe) {}

  startModule() {}

  startCapability() {}

  endCapability() {}

  endModule() {}
}
