/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asRuntimeKit } from "@google-labs/breadboard";
import {
  HarnessProxyConfig,
  HarnessRemoteConfig,
  defineServeConfig,
} from "@google-labs/breadboard/harness";
import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";
import Starter from "@google-labs/llm-starter";
import NodeNurseryWeb from "@google-labs/node-nursery-web";
import PaLMKit from "@google-labs/palm-kit";
import Pinecone from "@google-labs/pinecone-kit";

const PROXY_NODES = [
  "palm-generateText",
  "palm-embedText",
  "secrets",
  "fetch",
  // TODO: These are only meaningful when proxying to main thread,
  //       not anywhere else. Need to figure out what to do here.
  // "credentials",
  // "driveList",
];

const WORKER_URL =
  import.meta.env.MODE === "development" ? "/src/worker.ts" : "/worker.js";

const HARNESS_SWITCH_KEY = "bb-harness";

const PROXY_SERVER_HARNESS_VALUE = "proxy-server";
const WORKER_HARNESS_VALUE = "worker";

const PROXY_SERVER_URL = import.meta.env.VITE_PROXY_SERVER_URL;
const DEFAULT_HARNESS = PROXY_SERVER_URL
  ? PROXY_SERVER_HARNESS_VALUE
  : WORKER_HARNESS_VALUE;

const kits = [Starter, Core, Pinecone, PaLMKit, NodeNurseryWeb, JSONKit].map(
  (kitConstructor) => asRuntimeKit(kitConstructor)
);

export const createHarnessConfig = (url: string) => {
  const harness =
    globalThis.localStorage.getItem(HARNESS_SWITCH_KEY) ?? DEFAULT_HARNESS;

  const proxy: HarnessProxyConfig[] = [];
  if (harness === PROXY_SERVER_HARNESS_VALUE) {
    proxy.push({
      location: "http",
      url: PROXY_SERVER_URL,
      nodes: PROXY_NODES,
    });
  } else if (harness === WORKER_HARNESS_VALUE) {
    proxy.push({ location: "main", nodes: PROXY_NODES });
  }
  const remote: HarnessRemoteConfig = harness === WORKER_HARNESS_VALUE && {
    type: "worker",
    url: WORKER_URL,
  };
  const diagnostics = true;
  return { url, kits, remote, proxy, diagnostics };
};

export const serveConfig = defineServeConfig({
  transport: "worker",
  kits: [{ proxy: PROXY_NODES }, ...kits],
  diagnostics: true,
});
