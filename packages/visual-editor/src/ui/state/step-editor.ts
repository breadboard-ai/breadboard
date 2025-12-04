/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StepEditor, StepEditorSurface } from "./types";
import { signal } from "signal-utils";

export { StepEditorImpl };

class StepEditorImpl implements StepEditor {
  @signal
  accessor surface: StepEditorSurface | null = null;
}
