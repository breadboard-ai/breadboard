/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RunStateManager } from "./manager.js";
import type { ManagedRunState } from "./types.js";

export const createRunStateManager = (): ManagedRunState => {
  return new RunStateManager();
};
