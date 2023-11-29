/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Runtime {
  run(
    url: string,
    proxyNodes: string[]
  ): AsyncGenerator<RuntimeRunResult, void>;
}

export type Result = {
  id?: string;
  type: string;
  data: unknown;
};

export interface RuntimeRunResult {
  reply(reply: unknown): void;
  message: Result;
}
