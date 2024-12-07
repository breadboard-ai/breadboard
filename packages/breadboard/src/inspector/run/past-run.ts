/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../../harness/types.js";
import {
  EventIdentifier,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  InspectableRunNodeEvent,
  MutableGraphStore,
  TimelineEntry,
} from "../types.js";
import { Replay } from "./replay.js";
import { RunObserver } from "./run.js";

export class PastRun implements InspectableRun {
  #replay: Replay;
  #backingRun: InspectableRun | null = null;

  edges = [];

  constructor(
    public readonly dataStoreKey = crypto.randomUUID(),
    graphStore: MutableGraphStore,
    timeline: TimelineEntry[]
  ) {
    this.#replay = new Replay(graphStore, timeline, 0);
  }

  async initializeBackingRun(graphStore: MutableGraphStore) {
    const observer = new RunObserver(graphStore, {
      logLevel: "debug",
    });
    for await (const result of this.replay()) {
      await observer.observe(result);
    }
    this.#backingRun = (await observer.runs())[0];
  }

  get graphVersion(): number {
    if (!this.#backingRun) {
      throw new Error("Uninitialized run: can't yet provide graph versions");
    }
    return this.#backingRun.graphVersion;
  }

  get start(): number {
    if (!this.#backingRun) {
      throw new Error("Uninitialized run: can't yet provide start times");
    }
    return this.#backingRun.start;
  }
  get end(): number | null {
    if (!this.#backingRun) {
      throw new Error("Uninitialized run: can't yet provide end times");
    }
    return this.#backingRun.end;
  }

  get events(): InspectableRunEvent[] {
    if (!this.#backingRun) {
      throw new Error("Uninitialized run: can't yet provide events");
    }
    return this.#backingRun.events;
  }

  currentNodeEvent(): InspectableRunNodeEvent | null {
    if (!this.#backingRun) {
      throw new Error(
        "Uninitialized run: can't yet provide current node events"
      );
    }
    return this.#backingRun.currentNodeEvent();
  }

  stack(): InspectableRunNodeEvent[] {
    if (!this.#backingRun) {
      throw new Error("Uninitialized run: can't yet provide stack traces");
    }
    return this.#backingRun.stack();
  }

  getEventById(id: EventIdentifier): InspectableRunEvent | null {
    if (!this.#backingRun) {
      throw new Error("Uninitialized run: can't yet provide event IDs");
    }
    return this.#backingRun.getEventById(id);
  }

  inputs(): InspectableRunInputs | null {
    if (!this.#backingRun) {
      throw new Error("Uninitialized run: can't yet provide inputs");
    }
    return this.#backingRun.inputs();
  }

  async *replay(): AsyncGenerator<HarnessRunResult> {
    yield* this.#replay.replay();
  }
}
