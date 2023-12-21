/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Kit,
  NodeTypeIdentifier,
  OutputValues,
} from "@google-labs/breadboard";

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

export type SecretHandler = (keys: {
  keys?: string[];
}) => Promise<OutputValues>;

export type HarnessConfig = {
  proxy: NodeTypeIdentifier[];
  kits: Kit[];
  onSecret: SecretHandler;
};
