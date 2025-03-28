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

  addEdit(
    graph: GraphDescriptor,
    checkpoint: GraphDescriptor,
    label: string,
    version: number,
    creator?: EditHistoryCreator
  ) {
    this.#history.pause(label, checkpoint, version, creator);
    this.#history.add(graph, label, creator);
    this.#controller.onHistoryChanged?.(this.#historyIncludingPending);
  }

  canUndo(): boolean {
    return this.#history.canGoBack();
  }

  canRedo(): boolean {
    return this.#history.canGoForth();
  }

  undo(): void {
    this.#history.resume(this.#controller.graph(), this.#controller.version());
    const graph = this.#history.back();
    if (graph) {
      this.#controller.setGraph(graph);
    }
    this.#controller.onHistoryChanged?.(this.#historyIncludingPending);
  }

  redo(): void {
    this.#history.resume(this.#controller.graph(), this.#controller.version());
    const graph = this.#history.forth();
    if (graph) {
      this.#controller.setGraph(graph);
    }
    this.#controller.onHistoryChanged?.(this.#historyIncludingPending);
  }

  jump(index: number): void {
    this.#history.resume(this.#controller.graph(), this.#controller.version());
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

  add(
    graph: GraphDescriptor,
    label: string,
    creator?: EditHistoryCreator,
    timestamp?: number
  ) {
    if (this.paused()) return;
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
    if (this.paused()) {
      return null;
    }
    if (newIndex >= 0 && newIndex < this.history.length) {
      this.#index = newIndex;
    }
    return this.current();
  }

  paused() {
    return this.pauseLabel !== null;
  }

  pause(
    label: string,
    graph: GraphDescriptor,
    version: number,
    creator?: EditHistoryCreator
  ) {
    if (this.pauseLabel !== label) {
      this.resume(graph, version);
    }
    this.pauseLabel = label;
    this.pending = {
      graph,
      label,
      timestamp: Date.now(),
      creator: creator ?? { role: "unknown" },
    };
    this.#version = version;
  }

  resume(graph: GraphDescriptor, version: number) {
    if (this.pauseLabel === null) return;
    const label = this.pauseLabel;
    this.pauseLabel = null;
    if (this.#version !== version) {
      this.add(graph, label, this.pending?.creator);
    }
    this.pending = undefined;
  }
}
