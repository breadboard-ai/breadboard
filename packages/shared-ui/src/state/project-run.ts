/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalMap } from "signal-utils/map";
import { ConsoleEntry, ProjectRun, RunError } from "./types";
import {
  HarnessRunner,
  RunErrorEvent,
  RunGraphEndEvent,
  RunGraphStartEvent,
  RunInputEvent,
  RunNodeEndEvent,
  RunNodeStartEvent,
  RunOutputEvent,
} from "@google-labs/breadboard/harness";
import { signal } from "signal-utils";
import { formatError } from "../utils/format-error";

export { ReactiveProjectRun };

function idFromPath(path: number[]): string {
  return `e-${path.join("-")}`;
}

class ReactiveProjectRun implements ProjectRun {
  console: Map<string, ConsoleEntry> = new SignalMap();
  errors: Map<string, RunError> = new SignalMap();

  @signal
  accessor status: "running" | "paused" | "stopped" = "stopped";

  /**
   * Stores the path of the node that errored.
   */
  #errorPath: number[] | null = null;

  /**
   * Current (last) entry in console
   */
  @signal
  accessor current: ConsoleEntry | null = null;

  constructor(runner: HarnessRunner, signal?: AbortSignal) {
    if (signal) {
      signal.addEventListener("abort", this.#abort.bind(this));
    }
    runner.addEventListener("start", () => {
      this.status = "running";
    });
    runner.addEventListener("pause", () => {
      this.status = "paused";
    });
    runner.addEventListener("end", () => {
      this.status = "stopped";
    });
    runner.addEventListener("nodestart", this.#nodeStart.bind(this));
    runner.addEventListener("nodeend", this.#nodeEnd.bind(this));
    runner.addEventListener("graphstart", this.#graphStart.bind(this));
    runner.addEventListener("graphend", this.#graphEnd.bind(this));
    runner.addEventListener("input", this.#input.bind(this));
    runner.addEventListener("output", this.#output.bind(this));
    runner.addEventListener("error", this.#error.bind(this));
    runner.addEventListener("resume", () => {
      this.status = "running";
    });
  }

  #storeErrorPath(path: number[]) {
    if (this.#errorPath && this.#errorPath.length > path.length) {
      return;
    }
    this.#errorPath = path;
  }

  #abort() {
    this.status = "stopped";
  }

  #graphStart(event: RunGraphStartEvent) {
    const pathLength = event.data.path.length;

    if (pathLength > 0) return;

    console.debug("Project Run: Graph Start");
    this.console.clear();
    this.errors.clear();
    this.current = null;
  }

  #graphEnd(event: RunGraphEndEvent) {
    const pathLength = event.data.path.length;

    if (pathLength > 0) return;

    // TOOD: Do we need to do anything here?
    console.debug("Project Run: Graph End");
  }

  #nodeStart(event: RunNodeStartEvent) {
    console.debug("Project Run: Node Start", event);
    const pathLength = event.data.path.length;

    if (pathLength > 1) return;

    const { node } = event.data;

    // create new instance of the ConsoleEntry
    const entry: ConsoleEntry = {
      title: node.metadata?.title || node.id,
      icon: node.metadata?.icon,
      work: new SignalMap(),
      output: new SignalMap(),
    };
    this.current = entry;
    this.console.set(idFromPath(event.data.path), entry);
  }

  #nodeEnd(event: RunNodeEndEvent) {
    console.debug("Project Run: Node End", event);
    const pathLength = event.data.path.length;

    if (pathLength > 1) {
      if (event.data.outputs?.["$error"]) {
        this.#storeErrorPath(event.data.path);
      }
      return;
    }

    // TODO: Signal end of node
  }

  #input(event: RunInputEvent) {
    console.debug("Project Run: Input", event);
    const { bubbled, path } = event.data;

    // The non-bubbled inputs are not supported: they aren't found in the
    // new-style (A2-based) graphs.
    if (!bubbled) return;

    if (!this.current) {
      console.warn(`No current node for input event`, event);
      return;
    }

    // TODO: Handle inputs
    this.current.work.set(idFromPath(path), {
      title: "Input",
      icon: "Icon",
      elapsedTime: 0,
      finished: true,
      product: new SignalMap(),
    });
  }

  #output(event: RunOutputEvent) {
    console.debug("Project Run: Output", event);
    const { bubbled, path } = event.data;

    // The non-bubbled outputs are not supported: they aren't found in the
    // new-style (A2-based) graphs.
    if (!bubbled) return;

    if (!this.current) {
      console.warn(`No current node for input event`, event);
      return;
    }

    // TODO: Handle outputs
    this.current.work.set(idFromPath(path), {
      title: "Output",
      icon: "Icon",
      elapsedTime: 0,
      finished: true,
      product: new SignalMap(),
    });
  }

  #error(event: RunErrorEvent) {
    const message = formatError(event.data.error);
    const path = this.#errorPath || [];
    this.errors.set(idFromPath(path), { message });
  }
}
