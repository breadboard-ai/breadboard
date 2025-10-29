/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SimplifiedA2UIClient, WorkItem } from "@breadboard-ai/types";
import { Signal } from "signal-polyfill";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";

import { A2UIClient } from "./client";

export { A2UIClientWorkItem };

const now = new Signal.State(performance.now());

class A2UIClientWorkItem implements WorkItem {
  @signal
  accessor end: number | null = null;

  @signal
  get elapsed(): number {
    const end = this.end ?? now.get();
    return end - this.start;
  }
  /**
   * This means something different from us awaiting the user input in the
   * Console vernacular. Here, we always return false for now.
   */
  readonly awaitingUserInput = false;

  readonly start: number;

  readonly openByDefault = true;

  readonly chat = false;

  readonly product: Map<string, SimplifiedA2UIClient> = new SignalMap();

  readonly workItemId = crypto.randomUUID();

  constructor(
    private readonly client: A2UIClient,
    public readonly title: string,
    public readonly icon: string
  ) {
    this.start = performance.now();
  }

  renderUserInterface() {
    if (this.product.has(this.workItemId)) return;

    this.product.set(this.workItemId, this.client);
  }
}
