/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalMap } from "signal-utils/map";
import { ConsoleEntry, ProjectRun, RunError, UserInput } from "./types";
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
import { ReactiveConsoleEntry } from "./console-entry";
import { idFromPath } from "./common";
import { FileSystem, InspectableGraph } from "@google-labs/breadboard";

export { ReactiveProjectRun };

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
  accessor current: ReactiveConsoleEntry | null = null;

  @signal
  get estimatedEntryCount() {
    return Math.max(this.inspectable?.nodes().length || 0, this.console.size);
  }

  @signal
  accessor input: UserInput | null = null;

  constructor(
    private readonly inspectable: InspectableGraph | undefined,
    private readonly fileSystem: FileSystem,
    runner: HarnessRunner,
    signal?: AbortSignal
  ) {
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
      this.current = null;
      this.input = null;
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
    this.current = null;
    this.input = null;
  }

  #graphStart(event: RunGraphStartEvent) {
    const pathLength = event.data.path.length;

    if (pathLength > 0) return;

    console.debug("Project Run: Graph Start");
    this.console.clear();
    this.errors.clear();
    this.current = null;
    this.input = null; // can't be too cautious.
  }

  #graphEnd(event: RunGraphEndEvent) {
    const pathLength = event.data.path.length;

    if (pathLength > 0) return;

    this.input = null; // clean up just in case.

    // TOOD: Do we need to do anything here?
    console.debug("Project Run: Graph End", this.console);
  }

  #nodeStart(event: RunNodeStartEvent) {
    console.debug("Project Run: Node Start", event);
    const { path } = event.data;

    if (path.length > 1) {
      this.current?.onNodeStart(event.data);
      return;
    }

    const schema = this.inspectable
      ?.nodeById(event.data.node.id)
      ?.currentDescribe().outputSchema;
    const entry = new ReactiveConsoleEntry(this.fileSystem, event.data, schema);
    this.current = entry;
    this.console.set(entry.id, entry);
  }

  #nodeEnd(event: RunNodeEndEvent) {
    console.debug("Project Run: Node End", event);
    const pathLength = event.data.path.length;

    if (pathLength > 1) {
      this.current?.onNodeEnd(event.data, {
        completeInput: () => {
          this.input = null;
        },
      });
      if (event.data.outputs?.["$error"]) {
        this.#storeErrorPath(event.data.path);
      }
      return;
    }

    this.current?.finalize(event.data);
  }

  #input(event: RunInputEvent) {
    console.debug("Project Run: Input", event);
    if (!this.current) {
      console.warn(`No current node for input event`, event);
      return;
    }
    this.current.addInput(event.data, {
      itemCreated: (item) => {
        if (!item.schema) {
          console.warn(`Schema unavailable for input, skipping`, event.data);
          return;
        }
        this.input = {
          schema: item.schema,
        };
      },
    });
  }

  #output(event: RunOutputEvent) {
    console.debug("Project Run: Output", event);
    if (!this.current) {
      console.warn(`No current node for input event`, event);
      return;
    }
    this.current.addOutput(event.data);
  }

  #error(event: RunErrorEvent) {
    const message = formatError(event.data.error);
    const path = this.#errorPath || [];
    this.input = null;
    this.errors.set(idFromPath(path), { message });
  }
}
