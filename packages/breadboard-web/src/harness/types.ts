/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Kit, OutputValues } from "@google-labs/breadboard";
import type { NodeProxyConfig } from "@google-labs/breadboard/remote";

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

export type OldStyleHarnessConfig = {
  proxy: string[];
  onSecret: SecretHandler;
  kits: Kit[];
};

export type RuntimeLocation = "main" | "worker" | "http";
export type HarnessType = "client" | "server";

export type HarnessProxyConfig = {
  location: RuntimeLocation;
  url?: string;
  nodes: NodeProxyConfig;
};

export type HarnessConfig = {
  type: HarnessType;
  runtime: {
    location: RuntimeLocation;
    kits: Kit[];
  };
  proxy?: HarnessProxyConfig[];
  onSecret?: SecretHandler;
};

// const harnessConfigWorkerMainExample = {
//   type: "client",
//   runtime: {
//     location: "worker",
//     kits: [
//       /* kits go here */
//     ],
//   },
//   proxy: [
//     {
//       nodes: ["fetch", "palm-generateText"],
//       location: "main",
//     },
//   ],
// } satisfies HarnessConfig;

// const harnessConfigWorkerWorkerExample = {
//   type: "server",
//   runtime: {
//     location: "worker",
//     kits: [
//       /* kits go here */
//     ],
//   },
//   proxy: [
//     {
//       nodes: ["fetch", "palm-generateText"],
//       location: "main",
//     },
//   ],
// } satisfies HarnessConfig;

// const harnessConfigMainExample = {
//   type: "server",
//   runtime: {
//     location: "main",
//     kits: [
//       /* kits go here */
//     ],
//   },
// } satisfies HarnessConfig;

// const harnessConfigNodeProxyServerExample = {
//   type: "server",
//   runtime: {
//     location: "main",
//     kits: [
//       /* kits go here */
//     ],
//   },
//   proxy: [
//     {
//       nodes: ["fetch", "palm-generateText"],
//       location: "http",
//       url: "http://node-proxy-server.example.com",
//     },
//   ],
// } satisfies HarnessConfig;
