/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../types.js";

export class EditHistoryManager {
  history: GraphDescriptor[] = [];
  #index: number = 0;

  current(): GraphDescriptor | null {
    return this.history[this.#index] || null;
  }

  add(graph: GraphDescriptor) {
    // Chop off the history at #index.
    this.history.splice(this.#index + 1);
    // Insert new entry.
    this.history.push(graph);
    // Point #index the new entry.
    this.#index = this.history.length - 1;
    console.log("🌻 add", this);
  }

  back(): GraphDescriptor | null {
    this.#index && this.#index--;
    return this.current();
  }

  forth(): GraphDescriptor | null {
    const newIndex = this.#index + 1;
    const maxIndex = this.history.length - 1;
    if (newIndex <= maxIndex) {
      this.#index = newIndex;
    }
    return this.current();
  }
}
