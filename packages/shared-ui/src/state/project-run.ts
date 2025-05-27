/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalMap } from "signal-utils/map";
import { ConsoleEntry, ProjectRun } from "./types";
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

export { ReactiveProjectRun };

class ReactiveProjectRun implements ProjectRun {
  console: Map<string, ConsoleEntry> = new SignalMap();

  @signal
  accessor status: "running" | "paused" | "stopped" = "stopped";

  #connected = false;

  connect(runner: HarnessRunner, signal?: AbortSignal) {
    if (this.#connected) {
      console.warn("ProjectRun is already connected, ignoring this call site");
      return;
    }
    this.#connected = true;

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

  #abort() {
    this.status = "stopped";
  }

  #graphStart(event: RunGraphStartEvent) {
    const pathLength = event.data.path.length;

    if (pathLength > 0) return;

    this.console.clear();
  }

  #graphEnd(event: RunGraphEndEvent) {
    const pathLength = event.data.path.length;

    if (pathLength > 0) return;

    // TOOD: Do we need to do anything here?
  }

  #nodeStart(event: RunNodeStartEvent) {
    const pathLength = event.data.path.length;

    if (pathLength)
  }

  #nodeEnd(event: RunNodeEndEvent) {}
  #input(event: RunInputEvent) {}
  #output(event: RunOutputEvent) {}
  #error(event: RunErrorEvent) {}
}
