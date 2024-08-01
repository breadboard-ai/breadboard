/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues } from "../types.js";
import { RunStateManager } from "./manager.js";
import type { ManagedRunState, RunState } from "./types.js";

export const createRunStateManager = (
  resumeFrom: RunState = [],
  inputs?: InputValues
): ManagedRunState => {
  return new RunStateManager(resumeFrom, inputs);
};
