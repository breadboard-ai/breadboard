/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ConsoleUpdate,
  JsonSerializable,
  WorkItem,
} from "@breadboard-ai/types";
import { signal } from "signal-utils";
import { now } from "./now.js";
import { SignalMap } from "signal-utils/map";
import type { ProgressReporter } from "./types.js";
import { llm, type ErrorMetadata } from "../a2/utils.js";

export { ConsoleWorkItem };

/**
 * A simple WorkItem implementation for individual progress updates.
 * Can hold one or more ConsoleUpdates in its product map.
 * Implements ProgressReporter so it can be passed directly to executeStep.
 */
class ConsoleWorkItem implements WorkItem, ProgressReporter {
  readonly title: string;
  readonly icon?: string;
  readonly start: number;
  readonly awaitingUserInput = false;
  readonly openByDefault = false;
  readonly product: Map<string, ConsoleUpdate> = new SignalMap();

  @signal
  accessor end: number | null = null;

  #updateCounter = 0;

  @signal
  get elapsed(): number {
    const end = this.end ?? now.get();
    return end - this.start;
  }

  constructor(
    title: string,
    icon: string,
    update?: ConsoleUpdate,
    start?: number
  ) {
    this.start = start ?? performance.now();
    this.title = title;
    this.icon = icon;
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
   * Add JSON data to this work item.
   * Part of ProgressReporter interface.
   */
  addJson(title: string, data: unknown, icon?: string) {
    this.addProduct({
      type: "text",
      title,
      icon: icon ?? "data_object",
      body: { parts: [{ json: data as JsonSerializable }] },
    });
  }

  /**
   * Add an error to this work item.
   * Part of ProgressReporter interface.
   */
  addError(error: { $error: string; metadata?: ErrorMetadata }) {
    this.addProduct({
      type: "text",
      title: "Error",
      icon: "error",
      body: llm`${error.$error}`.asContent(),
    });
    return error;
  }

  /**
   * Mark this work item as finished.
   * Part of ProgressReporter interface.
   */
  finish() {
    this.end = performance.now();
  }
}
