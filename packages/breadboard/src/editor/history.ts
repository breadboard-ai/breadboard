/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../types.js";

export class EditHistoryManager {
  history: GraphDescriptor[] = [];
  #index: number = 0;
  pauseLabel: string | null = null;

  current(): GraphDescriptor | null {
    return structuredClone(this.history[this.#index] || null);
  }

  add(graph: GraphDescriptor) {
    if (this.paused()) return;
    // Chop off the history at #index.
    this.history.splice(this.#index + 1);
    // Insert new entry.
    this.history.push(structuredClone(graph));
    // Point #index the new entry.
    this.#index = this.history.length - 1;
  }

  canGoBack(): boolean {
    return !this.#index;
  }

  canGoForth(): boolean {
    return this.#index < this.history.length - 1;
  }

  back(): GraphDescriptor | null {
    if (this.paused()) return null;
    this.#index && this.#index--;
    return this.current();
  }

  forth(): GraphDescriptor | null {
    if (this.paused()) return null;
    const newIndex = this.#index + 1;
    const maxIndex = this.history.length - 1;
    if (newIndex <= maxIndex) {
      this.#index = newIndex;
    }
    return this.current();
  }

  paused() {
    return this.pauseLabel !== null;
  }

  pause(label: string, graph: GraphDescriptor) {
    if (this.pauseLabel !== label) {
      this.resume(graph);
    }
    this.pauseLabel = label;
  }

  resume(graph: GraphDescriptor) {
    if (this.pauseLabel === null) return;
    this.pauseLabel = null;
    this.add(graph);
  }
}
