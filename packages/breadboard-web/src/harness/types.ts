/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Kit, OutputValues } from "@google-labs/breadboard";
import type { NodeProxyConfig } from "@google-labs/breadboard/remote";

export interface Harness {
  run(url: string): AsyncGenerator<HarnessRunResult, void>;
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

export type RuntimeLocation = "main" | "worker" | "http";

export type HarnessProxyConfig = {
  location: RuntimeLocation;
  url?: string;
  nodes: NodeProxyConfig;
};

export type HarnessConfig = {
  runtime: {
    location: RuntimeLocation;
    url?: string;
    kits: Kit[];
  };
  proxy?: HarnessProxyConfig[];
  onSecret?: SecretHandler;
};
