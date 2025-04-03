/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "../types.js";
import type {
  EditHistory,
  EditHistoryController,
  EditHistoryCreator,
  EditHistoryEntry,
} from "./types.js";
import { SignalArray } from "signal-utils/array";
import { signal } from "signal-utils";

export class GraphEditHistory implements EditHistory {
  readonly #controller: EditHistoryController;
  readonly #entries = new SignalArray<EditHistoryEntry>();
  @signal accessor #index = 0;

  constructor(controller: EditHistoryController) {
    this.#controller = controller;
  }

  add(
    graph: GraphDescriptor,
    label: string,
    creator: EditHistoryCreator,
    timestamp: number
  ): void {
    this.#entries.splice(this.#index + 1);
    this.#entries.push({
      graph: structuredClone(graph),
      label,
      timestamp,
      creator,
    });
    this.#index = this.#entries.length - 1;
    this.#controller.onHistoryChanged?.([...this.#entries]);
  }

  revertTo(newIndex: number): EditHistoryEntry {
    this.#entries.splice(newIndex + 1);
    this.#index = newIndex;
    const revision = this.#entries[newIndex];
    this.#controller.setGraph(revision.graph);
    this.#controller.onHistoryChanged?.([...this.#entries]);
    return revision;
  }

  canUndo(): boolean {
    return this.#index > 0;
  }

  canRedo(): boolean {
    return this.#index < this.#entries.length - 1;
  }

  undo(): GraphDescriptor | null {
    return this.jump(this.#index - 1);
  }

  redo(): GraphDescriptor | null {
    return this.jump(this.#index + 1);
  }

  jump(newIndex: number): GraphDescriptor | null {
    if (newIndex >= 0 && newIndex < this.#entries.length) {
      this.#index = newIndex;
    }
    const entry = this.#entries[this.#index];
    const graph = entry ? structuredClone(entry.graph) : null;
    if (graph) {
      this.#controller.setGraph(graph);
    }
    this.#controller.onHistoryChanged?.([...this.#entries]);
    return graph;
  }

  entries(): EditHistoryEntry[] {
    return this.#entries;
  }

  index(): number {
    return this.#index;
  }

  current(): GraphDescriptor | null {
    return this.#entries[this.#index]?.graph ?? null;
  }

  get pending(): EditHistoryEntry | undefined {
    // TODO(aomarks) Add back (or refactor) when we are doing edit coalescing.
    return undefined;
  }
}
