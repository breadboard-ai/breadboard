/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../types.js";

type HistoryEntry = { graph: GraphDescriptor; label: string };

export class EditHistoryManager {
  history: HistoryEntry[] = [];
  #index: number = 0;
  pauseLabel: string | null = null;
  #version: number = 0;

  current(): GraphDescriptor | null {
    const entry = this.history[this.#index];
    if (!entry) return null;
    return structuredClone(entry.graph);
  }

  index() {
    return this.#index;
  }

  add(graph: GraphDescriptor, label: string) {
    if (this.paused()) return;
    // Chop off the history at #index.
    this.history.splice(this.#index + 1);
    // Insert new entry.
    this.history.push({ graph: structuredClone(graph), label });
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

  pause(label: string, graph: GraphDescriptor, version: number) {
    if (this.pauseLabel !== label) {
      this.resume(graph, version);
    }
    this.pauseLabel = label;
    this.#version = version;
  }

  resume(graph: GraphDescriptor, version: number) {
    if (this.pauseLabel === null) return;
    const label = this.pauseLabel;
    this.pauseLabel = null;
    if (this.#version !== version) {
      this.add(graph, label);
    }
  }
}
