/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createRunObserver,
  DataStore,
  InspectableRunObserver,
  Kit,
  RunStore,
} from "@google-labs/breadboard";
import { VETabId } from "./types";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import {
  createRunner,
  HarnessRunner,
  RunConfig,
  RunEdgeEvent,
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
} from "@google-labs/breadboard/harness";
import { VERunEvent } from "./events";

export class Run extends EventTarget {
  #runs = new Map<
    VETabId,
    {
      harnessRunner?: HarnessRunner;
      topGraphObserver?: BreadboardUI.Utils.TopGraphObserver;
      runObserver?: InspectableRunObserver;
    }
  >();

  constructor(
    public readonly dataStore: DataStore,
    public readonly runStore: RunStore,
    public readonly kits: Kit[]
  ) {
    super();
  }

  create(
    tabId: VETabId,
    topGraphObserver: BreadboardUI.Utils.TopGraphObserver,
    runObserver?: InspectableRunObserver
  ) {
    this.#runs.set(tabId, { topGraphObserver, runObserver });
  }

  getRunner(tabId: VETabId | null) {
    if (!tabId) {
      return null;
    }

    const run = this.#runs.get(tabId);
    if (!run) {
      return null;
    }

    return run.harnessRunner;
  }

  getObservers(tabId: VETabId | null) {
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

  runBoard(tabId: VETabId, config: RunConfig) {
    config = { ...config, kits: this.kits };

    const abortController = new AbortController();
    const runner = this.#createBoardRunner(config, abortController);
    this.#runs.set(tabId, runner);

    const { harnessRunner } = runner;
    harnessRunner.addEventListener("start", (evt: RunLifecycleEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("pause", (evt: RunLifecycleEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("resume", (evt: RunLifecycleEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("next", (evt: RunNextEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("input", (evt: RunInputEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("output", (evt: RunOutputEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("secret", (evt: RunSecretEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("error", (evt: RunErrorEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("skip", (evt: RunSkipEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("edge", (evt: RunEdgeEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("graphstart", (evt: RunGraphStartEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("graphend", (evt: RunGraphEndEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("nodestart", (evt: RunNodeStartEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("nodeend", (evt: RunNodeEndEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.addEventListener("end", (evt: RunEndEvent) => {
      this.dispatchEvent(
        new VERunEvent(tabId, evt, harnessRunner, abortController)
      );
    });

    harnessRunner.run();
  }

  #createBoardRunner(config: RunConfig, abortController: AbortController) {
    const harnessRunner = createRunner(config);
    const runObserver = createRunObserver({
      logLevel: "debug",
      dataStore: this.dataStore,
      runStore: this.runStore,
    });

    const topGraphObserver = new BreadboardUI.Utils.TopGraphObserver(
      harnessRunner,
      abortController.signal,
      runObserver
    );

    harnessRunner.addObserver(runObserver);

    return { harnessRunner, topGraphObserver, runObserver, abortController };
  }
}
