/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConsoleUpdate, WorkItem } from "@breadboard-ai/types";

export { ConsoleWorkItem };

/**
 * A simple WorkItem implementation for individual progress updates.
 * Each ConsoleWorkItem contains exactly one ConsoleUpdate and arrives "done"
 * (with end time already set).
 */
class ConsoleWorkItem implements WorkItem {
  readonly title: string;
  readonly icon?: string;
  readonly start: number;
  readonly end: number;
  readonly awaitingUserInput = false;
  readonly openByDefault = true;
  readonly product: Map<string, ConsoleUpdate>;

  get elapsed(): number {
    return this.end - this.start;
  }

  constructor(title: string, icon: string, update: ConsoleUpdate) {
    const now = performance.now();
    this.start = now;
    this.end = now; // Arrives "done"
    this.title = title;
    this.icon = icon;
    this.product = new Map([["content", update]]);
  }
}
