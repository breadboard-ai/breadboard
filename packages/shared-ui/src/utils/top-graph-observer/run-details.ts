/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  InspectableRunInputs,
  InspectableRunObserver,
  NodeIdentifier,
} from "@google-labs/breadboard";

export class RunDetails {
  #observer: InspectableRunObserver;
  #lastRunInputs: InspectableRunInputs | null = null;

  constructor(observer: InspectableRunObserver) {
    this.#observer = observer;
  }

  async initialize() {
    const runs = await this.#observer.runs();
    // Take inputs from the previous run.
    this.#lastRunInputs = runs[1].inputs();
  }

  lastRunInput(id: NodeIdentifier): InputValues | null {
    if (this.#lastRunInputs === null) {
      return null;
    }
    return this.#lastRunInputs.get(id)?.[0] || null;
  }
}
