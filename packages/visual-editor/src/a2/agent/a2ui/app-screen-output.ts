/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppScreenOutput,
  OutputValues,
  Schema,
  SimplifiedA2UIClient,
} from "@breadboard-ai/types";

export { A2UIAppScreenOutput };

class A2UIAppScreenOutput implements AppScreenOutput {
  constructor(public readonly a2ui: SimplifiedA2UIClient) {}
  /**
   * Unused
   */
  readonly output: OutputValues = {};
  /**
   * Unused
   */
  readonly schema: Schema | undefined = undefined;
}
