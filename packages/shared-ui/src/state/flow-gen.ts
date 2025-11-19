/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { FlowGenGenerationStatus, FlowGenState } from "./types";

export { createFlowGenState };

function createFlowGenState() {
  return new ReactiveFlowGenState();
}

class ReactiveFlowGenState implements FlowGenState {
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
}
