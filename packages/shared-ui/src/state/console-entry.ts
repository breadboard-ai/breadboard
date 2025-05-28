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
import { InputResponse, OutputResponse } from "@google-labs/breadboard";

export { ReactiveConsoleEntry };

function idFromPath(path: number[]): string {
  return `e-${path.join("-")}`;
}

class ReactiveConsoleEntry implements ConsoleEntry {
  title: string;
  icon?: string;
  work: Map<string, WorkItem> = new SignalMap();
  output: Map<string, LLMContent> = new SignalMap();
  id: string;

  #pendingTimestamp: number | null = null;

  constructor({ node, path }: NodeStartResponse) {
    this.title = node.metadata?.title || node.id;
    this.icon = node.metadata?.icon;
    this.id = idFromPath(path);
  }

  onNodeStart(data: NodeStartResponse) {
    const { type } = data.node;
    if (type === "input" || type === "output") {
      this.#pendingTimestamp = data.timestamp;
    }
  }

  onNodeEnd(data: NodeEndResponse) {
    const { type } = data.node;
    if (type === "input" || type === "output") {
      const item = this.work.get(idFromPath(data.path));
      // It's okay if we don't get anything here. Many inputs and outputs
      // will be non-bubbling.
      if (item) {
        item.end = data.timestamp;
      }
    }
  }

  addInput(data: InputResponse) {
    const { bubbled, path } = data;

    // The non-bubbled inputs are not supported: they aren't found in the
    // new-style (A2-based) graphs.
    if (!bubbled) return;

    // TODO: Handle inputs
    this.work.set(idFromPath(path), {
      title: "Input",
      icon: "Icon",
      start: this.#pendingTimestamp || 0,
      end: null,
      product: new SignalMap(),
    });
  }

  addOutput(data: OutputResponse) {
    const { bubbled, path } = data;
    // The non-bubbled outputs are not supported: they aren't found in the
    // new-style (A2-based) graphs.
    if (!bubbled) return;

    this.work.set(idFromPath(path), {
      title: "Output",
      icon: "Icon",
      start: this.#pendingTimestamp || 0,
      end: null,
      product: new SignalMap(),
    });
  }
}
