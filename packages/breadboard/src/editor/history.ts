/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../types.js";
import {
  EditHistory,
  EditHistoryController,
  EditHistoryEntry,
} from "./types.js";

export class GraphEditHistory implements EditHistory {
  #controller: EditHistoryController;
  #history: EditHistoryManager = new EditHistoryManager();

  constructor(controller: EditHistoryController) {
    this.#controller = controller;
  }

  add(graph: GraphDescriptor, label: string) {
    this.#history.add(graph, label);
  }

  addEdit(
    graph: GraphDescriptor,
    checkpoint: GraphDescriptor,
    label: string,
    version: number
  ) {
    this.#history.pause(label, checkpoint, version);

    this.#history.add(graph, label);
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
    if (!graph) return;
    this.#controller.setGraph(graph);
  }

  redo(): void {
    this.#history.resume(this.#controller.graph(), this.#controller.version());
    const graph = this.#history.forth();
    if (!graph) return;
    this.#controller.setGraph(graph);
  }

  entries(): EditHistoryEntry[] {
    return this.#history.history;
  }

  index(): number {
    return this.#history.index();
  }
}

export class EditHistoryManager {
  history: EditHistoryEntry[] = [];
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
