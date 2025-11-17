/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { StepListState, StepListStepState } from "./types";

export { StepList };

class StepList implements StepListState {
  steps: Map<string, StepListStepState> = new Map();

  @signal
  accessor intent: string | null = null;
}
