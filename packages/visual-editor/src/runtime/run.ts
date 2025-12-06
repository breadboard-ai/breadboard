/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createPlanRunner } from "../engine/runtime/harness/index.js";
import {
  HarnessRunner,
  Kit,
  MainGraphIdentifier,
  MutableGraphStore,
  RunConfig,
  RunEndEvent,
  RunErrorEvent,
  RunLifecycleEvent,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import { RuntimeBoardRunEvent } from "./events";
import { StateManager } from "./state";
import { Tab, TabId } from "./types";

export class Run extends EventTarget {
  #runs = new Map<
    TabId,
    {
      mainGraphId: MainGraphIdentifier;
      harnessRunner?: HarnessRunner;
      abortController?: AbortController;
    }
  >();

  constructor(
    public readonly graphStore: MutableGraphStore,
    public readonly state: StateManager,
    public readonly flags: RuntimeFlagManager,
    private readonly kits: Kit[]
  ) {
    super();
  }

  create(tab: Tab) {
    this.#runs.set(tab.id, {
      mainGraphId: tab.mainGraphId,
    });
  }

  async clearLastRun(tabId: TabId | null, urlToClear: string | undefined) {
    if (!tabId || !urlToClear) {
      return;
    }

    const run = this.#runs.get(tabId);
    if (run) {
      const project = this.state.project;
      if (project) {
        project.resetRun();
      }
    } else {
      console.warn(
        `Failed to clear console: unable to find ran with Tab Id "${tabId}"`
      );
    }

    this.#runs.delete(tabId);
  }

  /**
   * Used for diagnostics/debugging/demo purposes only.
   */
  get current() {
    return this.#runs.values().next().value?.harnessRunner;
  }

  getRunner(tabId: TabId | null) {
    if (!tabId) {
      return null;
    }

    const run = this.#runs.get(tabId);
    if (!run) {
      return null;
    }

    return run.harnessRunner ?? null;
  }

  getAbortSignal(tabId: TabId | null) {
    if (!tabId) {
      return null;
    }

    const run = this.#runs.get(tabId);
    if (!run) {
      return null;
    }

    return run.abortController ?? null;
  }

  async prepareRun(tab: Tab, config: RunConfig) {
    const abortController = new AbortController();
    const tabId = tab.id;
    config = {
      ...config,
      kits: this.kits,
      signal: abortController.signal,
      graphStore: this.graphStore,
    };

    const runner = this.#createBoardRunner(
      tab.mainGraphId,
      config,
      abortController
    );
    this.#runs.set(tabId, runner);

    const { harnessRunner } = runner;
    harnessRunner.addEventListener("start", (evt: RunLifecycleEvent) => {
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("pause", (evt: RunLifecycleEvent) => {
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("resume", (evt: RunLifecycleEvent) => {
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("error", (evt: RunErrorEvent) => {
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("end", (evt: RunEndEvent) => {
      config.fileSystem?.onEndRun?.();
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    // This incantation connects harnessRunner to the project, populating
    // `Project.run`.
    const project = this.state.project;
    if (!project) {
      console.warn(`Unable to get project for graph: ${tab.mainGraphId}`);
    } else {
      project.connectHarnessRunner(
        harnessRunner,
        config.fileSystem!,
        abortController.signal
      );
    }
  }

  hasRun(tab: Tab): boolean {
    return !!this.#runs.get(tab.id)?.harnessRunner;
  }

  async runBoard(tab: Tab) {
    const runInfo = this.#runs.get(tab.id);
    if (!runInfo) {
      console.warn(
        `Unable to run board: run info not found for tab "${tab.id}"`
      );
      return;
    }
    const runner = runInfo.harnessRunner;
    if (!runner) {
      console.warn(`Unable to run board: runner not found for tab "${tab.id}"`);
      return;
    }

    runner.run();
  }

  #createBoardRunner(
    mainGraphId: MainGraphIdentifier,
    config: RunConfig,
    abortController: AbortController
  ) {
    const harnessRunner = createPlanRunner(config);

    return {
      mainGraphId,
      harnessRunner,
      abortController,
    };
  }
}
