/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectableRunSequenceEntry } from "@google-labs/breadboard";
import { RunConfig } from "@breadboard-ai/types";

export type Result<T> =
  | {
      success: true;
      result: T;
    }
  | {
      success: false;
      error: string;
    };

export type RunNodeConfig = {
  config: Partial<RunConfig>;
  history: InspectableRunSequenceEntry[];
};
