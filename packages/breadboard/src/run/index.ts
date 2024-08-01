/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues } from "../types.js";
import { RunStateManager } from "./manager.js";
import { emptyEntry } from "./registry.js";
import type {
  LifecyclePathRegistryEntry,
  ManagedRunState,
  ReanimationInputs,
  ReanimationState,
  RunStackEntry,
} from "./types.js";

export const createRunStateManager = (
  resumeFrom: ReanimationState = {},
  inputs?: ReanimationInputs
): ManagedRunState => {
  return new RunStateManager(resumeFrom, inputs);
};
