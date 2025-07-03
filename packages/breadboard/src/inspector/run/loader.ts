/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { remapData } from "@breadboard-ai/data";
import type {
  DataStore,
  InspectableRunLoadResult,
  MutableGraphStore,
  SerializedDataStoreGroup,
  SerializedRun,
  SerializedRunLoadingOptions,
  TimelineEntry,
} from "@breadboard-ai/types";
import { PastRun } from "./past-run.js";
import { replaceSecrets } from "./serializer.js";

export class RunLoader {
  #graphStore: MutableGraphStore;
  #run: SerializedRun;
  #store: DataStore;
  #options: SerializedRunLoadingOptions;

  constructor(
    graphStore: MutableGraphStore,
    store: DataStore,
    o: unknown,
    options: SerializedRunLoadingOptions
  ) {
    this.#graphStore = graphStore;
    this.#store = store;
    this.#run = o as SerializedRun;
    this.#options = options;
  }

  async #inflateData(
    timeline: TimelineEntry[],
    serializedData: SerializedDataStoreGroup
  ): Promise<TimelineEntry[]> {
    return await Promise.all(
      timeline.map(async (entry) => {
        const [, data] = entry;
        entry[1] = (await remapData(
          this.#store,
          data,
          serializedData
        )) as Promise<TimelineEntry>;
        return entry;
      })
    );
  }

  async load(): Promise<InspectableRunLoadResult> {
    const run = this.#run;
    const runId = crypto.randomUUID();
    this.#store.createGroup(runId);

    if (run.$schema !== "tbd") {
      return {
        success: false,
        error: `Specified "$schema" is not valid`,
      };
    }
    try {
      const secretReplacer = this.#options?.secretReplacer;
      let timeline = secretReplacer
        ? replaceSecrets(run, secretReplacer).timeline
        : run.timeline;
      timeline = run.data
        ? await this.#inflateData(timeline, run.data)
        : timeline;
      const pastRun = new PastRun(runId, this.#graphStore, timeline);
      await pastRun.initializeBackingRun(this.#graphStore);
      return { success: true, run: pastRun };
    } catch (e) {
      const error = e as Error;
      return {
        success: false,
        error: `Loading run failed with the error ${error.message}`,
      };
    }
  }
}
