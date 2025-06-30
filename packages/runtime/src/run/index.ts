/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@breadboard-ai/types";
import { RunStateManager } from "./manager.js";
import type { ManagedRunState, ReanimationState } from "@breadboard-ai/types";

export const createRunStateManager = (
  resumeFrom: ReanimationState = {},
  inputs?: InputValues
): ManagedRunState => {
  return new RunStateManager(resumeFrom, inputs);
};
