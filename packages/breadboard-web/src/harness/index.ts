/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MainThreadHarness } from "./main-thread-harness";
import { ProxyServerHarness } from "./proxy-server-harness";
import { Harness, HarnessConfig } from "./types";
import { WorkerHarness } from "./worker-harness";

const HARNESS_SWITCH_KEY = "bb-harness";

const WORKER_URL =
  import.meta.env.MODE === "development" ? "/src/worker.ts" : "/worker.js";
const MAINTHREAD_HARNESS_VALUE = "main-thread";

const PROXY_SERVER_HARNESS_VALUE = "proxy-server";
const WORKER_HARNESS_VALUE = "worker";

const PROXY_SERVER_URL = import.meta.env.VITE_PROXY_SERVER_URL ?? "";
const DEFAULT_HARNESS = PROXY_SERVER_URL
  ? PROXY_SERVER_HARNESS_VALUE
  : WORKER_HARNESS_VALUE;

export const createHarness = (config: HarnessConfig): Harness => {
  const harness =
    globalThis.localStorage.getItem(HARNESS_SWITCH_KEY) ?? DEFAULT_HARNESS;
  switch (harness) {
    case MAINTHREAD_HARNESS_VALUE: {
      return new MainThreadHarness(config);
    }
    case PROXY_SERVER_HARNESS_VALUE: {
      const proxyServerUrl = PROXY_SERVER_URL;
      if (!proxyServerUrl) {
        throw new Error(
          "Unable to initialize proxy server harness. Please provide PROXY_SERVER_URL."
        );
      }
      return new ProxyServerHarness(proxyServerUrl, config);
    }
    case WORKER_HARNESS_VALUE: {
      return new WorkerHarness(WORKER_URL, config);
    }
  }
  throw new Error(`Unknown harness: ${harness}`);
};
