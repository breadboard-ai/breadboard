/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RunStateManager } from "./manager.js";
import type {
  ManagedRunState,
  ReanimationInputs,
  ReanimationState,
} from "./types.js";

export const createRunStateManager = (
  resumeFrom: ReanimationState = {},
  inputs?: ReanimationInputs
): ManagedRunState => {
  return new RunStateManager(resumeFrom, inputs);
};
