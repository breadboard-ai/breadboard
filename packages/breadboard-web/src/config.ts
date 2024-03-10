/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  HarnessProxyConfig,
  HarnessRemoteConfig,
  KitConfig,
  defineServeConfig,
  RunConfig,
} from "@google-labs/breadboard/harness";
import GeminiKit from "@google-labs/gemini-kit";
import { loadKits } from "./utils/kit-loader";

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
const LOCAL_HARNESS_VALUE = "local";

const PROXY_SERVER_URL = import.meta.env.VITE_PROXY_SERVER_URL;
const DEFAULT_HARNESS = PROXY_SERVER_URL
  ? PROXY_SERVER_HARNESS_VALUE
  : LOCAL_HARNESS_VALUE;

const kitConstructors = [GeminiKit];

export const createRunConfig = async (url: string): Promise<RunConfig> => {
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
  const kits = await loadKits(kitConstructors);
  return { url, kits, remote, proxy, diagnostics, runner: undefined };
};

export const createServeConfig = async () => {
  const kits = await loadKits(kitConstructors);
  return defineServeConfig({
    transport: "worker",
    kits: [{ proxy: PROXY_NODES } as KitConfig, ...kits],
    diagnostics: true,
  });
};
