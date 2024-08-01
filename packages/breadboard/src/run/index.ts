/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "../types.js";
import { RunStateManager } from "./manager.js";
import type { ManagedRunState, ReanimationState } from "./types.js";

export const createRunStateManager = (
  resumeFrom: ReanimationState = {},
  inputs?: InputValues
): ManagedRunState => {
  return new RunStateManager(resumeFrom, inputs);
};
