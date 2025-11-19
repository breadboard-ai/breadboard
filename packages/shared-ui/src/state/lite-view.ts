/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import {
  FlowGenGenerationStatus,
  LiteViewState,
  RuntimeContext,
  StepListState,
} from "./types";

export { createLiteViewState };

function createLiteViewState(context: RuntimeContext) {
  return new ReactiveLiteViewState(context);
}

class ReactiveLiteViewState implements LiteViewState {
  @signal
  accessor status: FlowGenGenerationStatus = "initial";

  @signal
  accessor error: string | undefined;

  @signal
  get intent() {
    if (this.status !== "initial" && this.#intent) return this.#intent;
    return "";
  }

  @signal
  accessor #intent: string | undefined;

  setIntent(intent: string) {
    this.#intent = intent;
  }

  get stepList(): StepListState | undefined {
    return this.context.currentProjectState()?.run.stepList;
  }

  constructor(private readonly context: RuntimeContext) {}
}
