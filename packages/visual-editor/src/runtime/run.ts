/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createRunObserver,
  InspectableRunObserver,
  InspectableRunSequenceEntry,
  Kit,
  MainGraphIdentifier,
  MutableGraphStore,
  RunStore,
} from "@google-labs/breadboard";
import {
  HarnessRunner,
  RunConfig,
  RunEndEvent,
  RunErrorEvent,
  RunGraphEndEvent,
  RunGraphStartEvent,
  RunInputEvent,
  RunLifecycleEvent,
  RunNextEvent,
  RunNodeEndEvent,
  RunNodeStartEvent,
  RunOutputEvent,
  RunSecretEvent,
  RunSkipEvent,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import { Tab, TabId } from "./types";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { createPlanRunner, createRunner } from "@breadboard-ai/runtime";
import { RuntimeBoardRunEvent } from "./events";
import { sandbox } from "../sandbox";
import { BoardServerAwareDataStore } from "@breadboard-ai/board-server-management";
import { StateManager } from "./state";

export class Run extends EventTarget {
  #runs = new Map<
    TabId,
    {
      mainGraphId: MainGraphIdentifier;
      harnessRunner?: HarnessRunner;
      topGraphObserver?: BreadboardUI.Utils.TopGraphObserver;
      runObserver?: InspectableRunObserver;
      abortController?: AbortController;
      kits: Kit[];
    }
  >();

  constructor(
    public readonly graphStore: MutableGraphStore,
    public readonly dataStore: BoardServerAwareDataStore,
    public readonly runStore: RunStore,
    public readonly state: StateManager,
    public readonly flags: RuntimeFlagManager
  ) {
    super();
  }

  create(
    tab: Tab,
    topGraphObserver: BreadboardUI.Utils.TopGraphObserver,
    runObserver?: InspectableRunObserver
  ) {
    this.#runs.set(tab.id, {
      mainGraphId: tab.mainGraphId,
      topGraphObserver,
      runObserver,
      kits: [...this.graphStore.kits, ...tab.boardServerKits],
    });
  }

  async clearLastRun(tabId: TabId | null, urlToClear: string | undefined) {
    if (!tabId || !urlToClear) {
      return;
    }

    const run = this.#runs.get(tabId);
    if (run) {
      const project = this.state.getOrCreateProjectState(run.mainGraphId);
      if (project) {
        project.resetRun();
      }
    } else {
      console.warn(
        `Failed to clear console: unable to find ran with Tab Id "${tabId}"`
      );
    }

    this.#runs.delete(tabId);

    return this.runStore.truncate(urlToClear, 1);
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

  getObservers(tabId: TabId | null) {
    if (!tabId) {
      return null;
    }

    const run = this.#runs.get(tabId);
    if (!run) {
      return null;
    }

    const { topGraphObserver, runObserver } = run;
    return { topGraphObserver, runObserver };
  }

  async prepareRun(
    tab: Tab,
    config: RunConfig,
    history?: InspectableRunSequenceEntry[]
  ) {
    const abortController = new AbortController();
    const tabId = tab.id;
    config = {
      ...config,
      store: this.dataStore.createRunDataStore(config.url),
      kits: [...this.graphStore.kits, ...tab.boardServerKits],
      signal: abortController.signal,
      graphStore: this.graphStore,
    };

    const usePlanRunner = (await this.flags.flags()).usePlanRunner;

    const runner = this.#createBoardRunner(
      tab.mainGraphId,
      usePlanRunner,
      config,
      abortController
    );
    this.#runs.set(tabId, runner);

    const { harnessRunner, runObserver, topGraphObserver } = runner;
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

    harnessRunner.addEventListener("next", (evt: RunNextEvent) => {
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("input", (evt: RunInputEvent) => {
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("output", (evt: RunOutputEvent) => {
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("secret", (evt: RunSecretEvent) => {
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("error", (evt: RunErrorEvent) => {
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("skip", (evt: RunSkipEvent) => {
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("graphstart", (evt: RunGraphStartEvent) => {
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("graphend", (evt: RunGraphEndEvent) => {
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("nodestart", (evt: RunNodeStartEvent) => {
      this.dispatchEvent(
        new RuntimeBoardRunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("nodeend", (evt: RunNodeEndEvent) => {
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
    const project = this.state.getOrCreateProjectState(tab.mainGraphId);
    if (!project) {
      console.warn(`Unable to get project for graph: ${tab.mainGraphId}`);
    } else {
      project.connectHarnessRunner(
        harnessRunner,
        config.fileSystem!,
        abortController.signal
      );
    }

    if (history) {
      await runObserver.append(history);
      topGraphObserver.startWith(history);
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
    usePlanRunner: boolean,
    config: RunConfig,
    abortController: AbortController
  ) {
    const harnessRunner = usePlanRunner
      ? createPlanRunner(config)
      : createRunner(config);
    const runObserver = createRunObserver(this.graphStore, {
      logLevel: "debug",
      dataStore: this.dataStore,
      runStore: this.runStore,
      kits: config.kits,
      sandbox: sandbox,
    });

    const topGraphObserver = new BreadboardUI.Utils.TopGraphObserver(
      harnessRunner,
      config.signal,
      runObserver
    );

    harnessRunner.addObserver(runObserver);

    return {
      mainGraphId,
      harnessRunner,
      topGraphObserver,
      runObserver,
      abortController,
      kits: config.kits,
    };
  }
}
