/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../types.js";
import {
  EditHistory,
  EditHistoryController,
  EditHistoryCreator,
  EditHistoryEntry,
} from "./types.js";
import { SignalArray } from "signal-utils/array";
import { signal } from "signal-utils";

export class GraphEditHistory implements EditHistory {
  #controller: EditHistoryController;
  #history: EditHistoryManager = new EditHistoryManager();

  constructor(controller: EditHistoryController) {
    this.#controller = controller;
  }

  add(
    graph: GraphDescriptor,
    label: string,
    creator?: EditHistoryCreator,
    timestamp?: number
  ) {
    this.#history.add(graph, label, creator, timestamp);
    this.#controller.onHistoryChanged?.(this.#historyIncludingPending);
  }

  addEdit(graph: GraphDescriptor, label: string, creator?: EditHistoryCreator) {
    this.#history.add(graph, label, creator);
    this.#controller.onHistoryChanged?.(this.#historyIncludingPending);
  }

  revertTo(index: number) {
    const revision = this.#history.revertTo(index);
    this.#controller.setGraph(revision.graph);
    this.#controller.onHistoryChanged?.(this.#historyIncludingPending);
    return revision;
  }

  canUndo(): boolean {
    return this.#history.canGoBack();
  }

  canRedo(): boolean {
    return this.#history.canGoForth();
  }

  undo(): void {
    const graph = this.#history.back();
    if (graph) {
      this.#controller.setGraph(graph);
    }
    this.#controller.onHistoryChanged?.(this.#historyIncludingPending);
  }

  redo(): void {
    const graph = this.#history.forth();
    if (graph) {
      this.#controller.setGraph(graph);
    }
    this.#controller.onHistoryChanged?.(this.#historyIncludingPending);
  }

  jump(index: number): void {
    const graph = this.#history.jump(index);
    if (graph) {
      this.#controller.setGraph(graph);
    }
    this.#controller.onHistoryChanged?.(this.#historyIncludingPending);
  }

  entries(): EditHistoryEntry[] {
    return this.#history.history;
  }

  index(): number {
    return this.#history.index();
  }

  get pending() {
    return this.#history.pending;
  }

  get #historyIncludingPending() {
    const { pending, history } = this.#history;
    return pending
      ? [...history.slice(0, this.#history.index() + 1), pending]
      : history.slice();
  }
}

export class EditHistoryManager {
  readonly history = new SignalArray<EditHistoryEntry>();
  @signal
  accessor #index = 0;
  @signal
  accessor pending: EditHistoryEntry | undefined;

  current(): GraphDescriptor | null {
    const entry = this.history[this.#index];
    if (!entry) return null;
    return structuredClone(entry.graph);
  }

  index() {
    return this.#index;
  }

  revertTo(index: number) {
    this.history.splice(index + 1);
    this.#index = index;
    this.pending = undefined;
    return this.history[index];
  }

  add(
    graph: GraphDescriptor,
    label: string,
    creator?: EditHistoryCreator,
    timestamp?: number
  ) {
    // Chop off the history at #index.
    this.history.splice(this.#index + 1);
    // Insert new entry.
    this.history.push({
      graph: structuredClone(graph),
      label,
      timestamp: timestamp ?? Date.now(),
      creator: creator ?? { role: "unknown" },
    });
    // Point #index the new entry.
    this.#index = this.history.length - 1;
  }

  canGoBack(): boolean {
    return this.#index > 0;
  }

  canGoForth(): boolean {
    return this.#index < this.history.length - 1;
  }

  back(): GraphDescriptor | null {
    return this.jump(this.#index - 1);
  }

  forth(): GraphDescriptor | null {
    return this.jump(this.#index + 1);
  }

  jump(newIndex: number) {
    if (newIndex >= 0 && newIndex < this.history.length) {
      this.#index = newIndex;
    }
    return this.current();
  }
}
