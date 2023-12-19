/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Harness {
  run(
    url: string,
    proxyNodes: string[]
  ): AsyncGenerator<HarnessRunResult, void>;
}

export type Result = {
  id?: string;
  type: string;
  data: unknown;
};

export interface HarnessRunResult {
  reply(reply: unknown): void;
  message: Result;
}
