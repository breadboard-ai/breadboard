/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../../harness/types.js";
import { replaceSecrets } from "./serializer.js";
import {
  InspectableRunLoadResult,
  InspectableRunObserver,
  SerializedRun,
  SerializedRunLoadingOptions,
} from "../types.js";

export class RunLoader {
  #observer: InspectableRunObserver;

  constructor(observer: InspectableRunObserver) {
    this.#observer = observer;
  }

  load(
    o: unknown,
    options?: SerializedRunLoadingOptions
  ): InspectableRunLoadResult {
    const data = o as SerializedRun;
    if (data.$schema !== "tbd") {
      return {
        success: false,
        error: `Specified "$schema" is not valid`,
      };
    }
    try {
      const timeline = options?.secretReplacer
        ? replaceSecrets(data, options.secretReplacer).timeline
        : data.timeline;
      for (const result of timeline) {
        this.#observer.observe(result as HarnessRunResult);
      }
      return { success: true };
    } catch (e) {
      const error = e as Error;
      return {
        success: false,
        error: `Loading run failed with the error ${error.message}`,
      };
    }
  }
}
