/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ParticleTree, ParticleTreeImpl } from "@breadboard-ai/particles";
import {
  HarnessRunner,
  RunConfig,
  RunErrorEvent,
  RunGraphEndEvent,
  RunGraphStartEvent,
  RunInputEvent,
  RunNodeEndEvent,
  RunNodeStartEvent,
  RunOutputEvent,
  Schema,
} from "@breadboard-ai/types";
import {
  err,
  FileSystem,
  InspectableGraph,
  MainGraphIdentifier,
  MutableGraphStore,
  Outcome,
  OutputValues,
} from "@google-labs/breadboard";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { getStepIcon } from "../utils/get-step-icon";
import { ReactiveApp } from "./app";
import { ReactiveAppScreen } from "./app-screen";
import { getParticleStreamHandle, idFromPath } from "./common";
import { ReactiveConsoleEntry } from "./console-entry";
import {
  AppScreenOutput,
  ConsoleEntry,
  EphemeralParticleTree,
  ProjectRun,
  RunError,
  UserInput,
} from "./types";
import { decodeError } from "./utils/decode-error";
import { ParticleOperationReader } from "./utils/particle-operation-reader";

export {
  createProjectRunState,
  createProjectRunStateFromFinalOutput,
  ReactiveProjectRun,
};

function createProjectRunStateFromFinalOutput(
  runConfig: RunConfig,
  output: OutputValues
): Outcome<ProjectRun> {
  const { graphStore, runner: graph } = runConfig;
  if (!graph) {
    return error(`Graph wasn't specified`);
  }
  if (!graphStore) {
    return error(`Graph store wasn't supplied`);
  }

  const gettingMainGraph = graphStore.getByDescriptor(graph);
  if (!gettingMainGraph?.success) {
    return error(`Can't to find graph in graph store`);
  }
  const run = ReactiveProjectRun.createInert(
    gettingMainGraph.result,
    graphStore
  );
  const last: AppScreenOutput = {
    output,
    schema: {},
  };
  const current = new ReactiveAppScreen("", [], undefined);
  current.outputs.set("final", last);
  run.app.screens.set("final", current);
  return run;
}

function createProjectRunState(
  runConfig: RunConfig,
  harnessRunner: HarnessRunner
): Outcome<ProjectRun> {
  const { fileSystem, graphStore, runner: graph, signal } = runConfig;
  if (!fileSystem) {
    return error(`File system wasn't initialized`);
  }
  if (!graph) {
    return error(`Graph wasn't specified`);
  }
  if (!graphStore) {
    return error(`Graph store wasn't supplied`);
  }

  const gettingMainGraph = graphStore.getByDescriptor(graph);
  if (!gettingMainGraph?.success) {
    return error(`Can't to find graph in graph store`);
  }
  return ReactiveProjectRun.create(
    gettingMainGraph.result,
    graphStore,
    fileSystem,
    harnessRunner,
    signal
  );
}

function error(msg: string) {
  const full = `Unable to create project run state: ${msg}`;
  console.error(full);
  return err(full);
}

function topLevel(path: number[]) {
  return idFromPath(path.toSpliced(1));
}

class ReactiveProjectRun implements ProjectRun {
  app: ReactiveApp = new ReactiveApp();
  console: Map<string, ConsoleEntry> = new SignalMap();
  errors: Map<string, RunError> = new SignalMap();

  @signal
  accessor status: "running" | "paused" | "stopped" = "stopped";

  /**
   * Stores the path of the node that errored.
   */
  #errorPath: number[] | null = null;

  /**
   * Currently active (unfinished) entries in console.
   */
  @signal
  accessor current: Map<string, ReactiveConsoleEntry> | null = null;

  @signal
  get estimatedEntryCount() {
    return Math.max(this.#inspectable?.nodes().length || 0, this.console.size);
  }

  @signal
  get progress() {
    if (this.estimatedEntryCount === 0) {
      return 0;
    }

    return this.console.size / this.estimatedEntryCount;
  }

  @signal
  get consoleState() {
    return this.console.size > 0 ? "entries" : "start";
  }

  @signal
  get runnable() {
    return this.#inspectable?.nodes().length !== 0;
  }

  @signal
  accessor input: UserInput | null = null;

  @signal
  accessor #inspectable: InspectableGraph | undefined;

  @signal
  get finalOutput(): OutputValues | null {
    if (this.status !== "stopped") return null;

    return this.app.current?.last?.output || null;
  }

  private constructor(
    private readonly mainGraphId: MainGraphIdentifier,
    private readonly graphStore?: MutableGraphStore,
    private readonly fileSystem?: FileSystem,
    runner?: HarnessRunner,
    signal?: AbortSignal
  ) {
    if (!runner) return;
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

    if (!graphStore) return;

    this.#inspectable = this.graphStore?.inspect(this.mainGraphId, "");

    graphStore.addEventListener("update", (e) => {
      if (e.mainGraphId === this.mainGraphId) {
        this.#inspectable = this.graphStore?.inspect(this.mainGraphId, "");
      }
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
      this.current?.get(topLevel(path))?.onNodeStart(event.data);
      return;
    }

    const node = this.#inspectable?.nodeById(event.data.node.id);
    const metadata = node?.currentDescribe()?.metadata || {};
    const { icon: defaultIcon, tags } = metadata;
    const icon = getStepIcon(defaultIcon, node?.currentPorts()) || undefined;
    const title = node?.title();
    const outputSchema = node?.currentDescribe()?.outputSchema;
    const entry = new ReactiveConsoleEntry(
      this.fileSystem,
      { title, icon, tags },
      path,
      outputSchema
    );
    this.current ??= new SignalMap();
    this.current.set(topLevel(path), entry);
    this.console.set(entry.id, entry);

    // This looks like duplication with the console logic above,
    // but it's a hedge toward the future where screens and console entries
    // might go out of sync.
    // See https://github.com/breadboard-ai/breadboard/wiki/Screens
    const screen = new ReactiveAppScreen(title || "", path, outputSchema);
    this.app.screens.set(screen.id, screen);
  }

  #nodeEnd(event: RunNodeEndEvent) {
    console.debug("Project Run: Node End", event);
    const { path } = event.data;
    const pathLength = path.length;

    if (pathLength > 1) {
      this.current?.get(topLevel(path))?.onNodeEnd(event.data, {
        completeInput: () => {
          this.input = null;
        },
      });
      if (event.data.outputs?.["$error"]) {
        this.#storeErrorPath(event.data.path);
      }
      return;
    }

    this.current?.get(topLevel(path))?.finalize(event.data);
    this.app.current?.finalize(event.data);
  }

  #input(event: RunInputEvent) {
    const { path } = event.data;
    console.debug("Project Run: Input", event);
    if (!this.current) {
      console.warn(`No current console entry found for input event`, event);
      return;
    }
    const currentId = topLevel(path);
    const currentConsoleEntry = this.current.get(currentId);
    if (!currentConsoleEntry) {
      console.warn(`No current console entry found at path "${path}"`);
      return;
    }
    const currentScreen = this.app.screens.get(currentId);
    if (!currentScreen) {
      console.warn(`No current screen found at path "${path}"`);
    } else {
      // Bump it to the bottom of the list (last item = really current);
      this.app.screens?.delete(currentId);
      this.app.screens?.set(currentId, currentScreen);
    }
    this.current.delete(currentId);
    this.current.set(currentId, currentConsoleEntry);
    currentConsoleEntry.addInput(event.data, {
      itemCreated: (item) => {
        currentScreen?.markAsInput();
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
    const { path, bubbled, node, outputs } = event.data;
    console.debug("Project Run: Output", event);
    if (!this.current) {
      console.warn(`No current console entry for output event`, event);
      return;
    }

    // The non-bubbled outputs are not supported: they aren't found in the
    // new-style (A2-based) graphs.
    if (!bubbled) return;

    const { configuration = {} } = node;
    const { schema: s = {} } = configuration;

    const schema = s as Schema;

    let particleTree: EphemeralParticleTree | null = null;
    const particleStreamHandle = getParticleStreamHandle(schema, outputs);
    if (particleStreamHandle) {
      if (!this.fileSystem) {
        console.warn(
          `Particle stream "${particleStreamHandle}" provided, but file system is not available`
        );
      } else {
        particleTree = new EphemeralParticleTreeImpl(
          this.fileSystem,
          particleStreamHandle
        );
      }
    }

    this.current.get(topLevel(path))?.addOutput(event.data, particleTree);
    if (!this.app.current) {
      console.warn(`No current screen for output event`, event);
      return;
    }
    this.app.screens.get(topLevel(path))?.addOutput(event.data, particleTree);
  }

  #error(event: RunErrorEvent) {
    const error = decodeError(event);
    const path = this.#errorPath || [];
    this.input = null;
    this.errors.set(idFromPath(path), error);
  }

  /**
   * Creates an inert (incapable of running) instance of a ProjectRun.
   * This instance is useful for representing and inspecting the run that
   * hasn't yet started.
   */
  static createInert(
    mainGraphId: MainGraphIdentifier,
    graphStore: MutableGraphStore
  ) {
    return new ReactiveProjectRun(mainGraphId, graphStore);
  }

  static create(
    mainGraphId: MainGraphIdentifier,
    graphStore: MutableGraphStore,
    fileSystem: FileSystem,
    runner: HarnessRunner,
    signal?: AbortSignal
  ) {
    return new ReactiveProjectRun(
      mainGraphId,
      graphStore,
      fileSystem,
      runner,
      signal
    );
  }
}

class EphemeralParticleTreeImpl implements EphemeralParticleTree {
  public readonly tree: ParticleTree;

  @signal
  accessor done = false;

  constructor(fileSystem: FileSystem, path: string) {
    this.tree = new ParticleTreeImpl();
    this.#start(fileSystem, path);
  }

  async #start(fileSystem: FileSystem, path: string) {
    const reader = new ParticleOperationReader(fileSystem, path);
    for await (const operation of reader) {
      this.tree.apply(operation);
    }
    this.done = true;
  }
}
