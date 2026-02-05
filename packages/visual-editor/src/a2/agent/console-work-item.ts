/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConsoleUpdate, WorkItem } from "@breadboard-ai/types";
import { signal } from "signal-utils";
import { now } from "./now.js";

export { ConsoleWorkItem };

/**
 * A simple WorkItem implementation for individual progress updates.
 * Can hold one or more ConsoleUpdates in its product map.
 */
class ConsoleWorkItem implements WorkItem {
  readonly title: string;
  readonly icon?: string;
  readonly start: number;
  readonly awaitingUserInput = false;
  readonly openByDefault = false;
  readonly product: Map<string, ConsoleUpdate>;

  @signal
  accessor end: number | null = null;

  #updateCounter = 0;

  @signal
  get elapsed(): number {
    const end = this.end ?? now.get();
    return end - this.start;
  }

  constructor(title: string, icon: string, update?: ConsoleUpdate) {
    this.start = performance.now();
    this.title = title;
    this.icon = icon;
    this.product = new Map();
    if (update) {
      this.addProduct(update);
    }
  }

  /**
   * Add a product to this work item.
   */
  addProduct(update: ConsoleUpdate) {
    const key = `content-${this.#updateCounter++}`;
    this.product.set(key, update);
  }

  /**
   * Mark this work item as finished.
   */
  finish() {
    this.end = performance.now();
  }
}
