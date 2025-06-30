/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CapabilitySpec } from "@breadboard-ai/jsandbox";

export type CapabilitiesManager = {
  createSpec(): CapabilitySpec;
};
