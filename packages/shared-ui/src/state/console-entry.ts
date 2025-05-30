/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LLMContent,
  NodeEndResponse,
  NodeStartResponse,
} from "@breadboard-ai/types";
import { ConsoleEntry, WorkItem } from "./types";
import { SignalMap } from "signal-utils/map";
import {
  FileSystem,
  InputResponse,
  OutputResponse,
  Schema,
} from "@google-labs/breadboard";
import { idFromPath, toLLMContentArray } from "./common";
import { ReactiveWorkItem } from "./work-item";
import { signal } from "signal-utils";

export { ReactiveConsoleEntry };

export type OnNodeEndCallbacks = {
  completeInput: () => void;
};

export type AddInputCallbacks = {
  itemCreated: (item: WorkItem) => void;
};

class ReactiveConsoleEntry implements ConsoleEntry {
  title: string;
  icon?: string;
  work: Map<string, WorkItem> = new SignalMap();
  output: Map<string, LLMContent> = new SignalMap();
  id: string;

  @signal
  accessor completed = false;

  @signal
  get current() {
    return Array.from(this.work.values()).at(-1) || null;
  }

  #pendingTimestamp: number | null = null;
  #outputSchema: Schema | undefined;

  constructor(
    private readonly fileSystem: FileSystem,
    { node, path }: NodeStartResponse,
    outputSchema: Schema | undefined
  ) {
    this.title = node.metadata?.title || node.id;
    this.icon = node.metadata?.icon;
    this.id = idFromPath(path);
    this.#outputSchema = outputSchema;
  }

  onNodeStart(data: NodeStartResponse) {
    const { type } = data.node;
    if (type === "input" || type === "output") {
      this.#pendingTimestamp = data.timestamp;
    }
  }

  onNodeEnd(data: NodeEndResponse, callbacks: OnNodeEndCallbacks) {
    const { type } = data.node;
    if (type === "input" || type === "output") {
      const item = this.work.get(idFromPath(data.path));
      // It's okay if we don't get anything here. Many inputs and outputs
      // will be non-bubbling.
      if (item) {
        item.end = data.timestamp;
        if (type === "input") {
          ReactiveWorkItem.completeInput(item, data);
          callbacks.completeInput();
        }
      }
    }
  }

  finalize(data: NodeEndResponse) {
    const { outputs } = data;
    const { products } = toLLMContentArray(this.#outputSchema || {}, outputs);
    for (const [name, product] of Object.entries(products)) {
      this.output.set(name, product);
    }
    this.completed = true;
  }

  addInput(data: InputResponse, callbacks: AddInputCallbacks) {
    const { bubbled } = data;
    // The non-bubbled inputs are not supported: they aren't found in the
    // new-style (A2-based) graphs.
    if (!bubbled) return;

    const [id, item] = ReactiveWorkItem.fromInput(
      data,
      this.#pendingTimestamp || 0
    );

    callbacks.itemCreated(item);

    this.work.set(id, item);
  }

  addOutput(data: OutputResponse) {
    const { bubbled } = data;
    // The non-bubbled outputs are not supported: they aren't found in the
    // new-style (A2-based) graphs.
    if (!bubbled) return;

    this.work.set(
      ...ReactiveWorkItem.fromOutput(
        this.fileSystem,
        data,
        this.#pendingTimestamp || 0
      )
    );
  }
}
