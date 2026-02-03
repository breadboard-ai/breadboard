/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FlowGenGenerationStatus,
  LiteModeType,
  LiteModeState,
  RuntimeContext,
  LiteModePlannerState,
} from "./types.js";
import { GraphDescriptor } from "@breadboard-ai/types";
import { SCA } from "../../sca/sca.js";
import { deriveLiteViewType } from "../../sca/utils/lite-view-type.js";

export { createLiteModeState };

function createLiteModeState(_context: RuntimeContext, sca: SCA) {
  return new ReactiveLiteModeState(sca);
}

/**
 * Facade over SCA state for lite mode consumers.
 *
 * This class is being hollowed out.
 * All state is now delegated to SCA controllers. This file can be deleted
 * once all consumers are updated to read SCA directly.
 */
class ReactiveLiteModeState implements LiteModeState {
  constructor(private readonly sca: SCA) {}

  // === Delegated to GlobalController ===

  get viewError() {
    return this.sca.controller.global.main.viewError;
  }
  set viewError(value: string) {
    this.sca.controller.global.main.viewError = value;
  }

  // === Delegated to FlowgenInputController ===

  get status(): FlowGenGenerationStatus {
    return this.sca.controller.global.flowgenInput.state.status;
  }

  get error(): string | undefined {
    const state = this.sca.controller.global.flowgenInput.state;
    if (state.status === "error") {
      return String(state.error);
    }
    return undefined;
  }

  startGenerating() {
    this.sca.controller.global.flowgenInput.startGenerating();
  }

  finishGenerating() {
    this.sca.controller.global.flowgenInput.finishGenerating();
  }

  get intent() {
    return this.sca.controller.global.flowgenInput.intent;
  }

  setIntent(intent: string) {
    this.sca.controller.global.flowgenInput.setIntent(intent);
  }

  get examples() {
    return this.sca.controller.global.flowgenInput.examples;
  }

  get currentExampleIntent() {
    return this.sca.controller.global.flowgenInput.currentExampleIntent;
  }
  set currentExampleIntent(value: string) {
    this.sca.controller.global.flowgenInput.currentExampleIntent = value;
  }

  get planner(): LiteModePlannerState {
    return {
      status: this.sca.controller.global.flowgenInput.plannerStatus,
      thought: this.sca.controller.global.flowgenInput.plannerThought,
    };
  }

  // === Delegated to GraphController ===

  get graph(): GraphDescriptor | null {
    return this.sca.controller.editor.graph.graph;
  }

  get empty() {
    return this.sca.controller.editor.graph.empty;
  }

  // === Computed from SCA state ===

  get viewType(): LiteModeType {
    return deriveLiteViewType(this.sca, this.empty);
  }
}
