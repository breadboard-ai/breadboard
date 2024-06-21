/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Kit } from "@google-labs/breadboard";
import {
  AnyProxyRequestMessage,
  AnyProxyResponseMessage,
  ProxyClient,
  WorkerClientTransport,
} from "@google-labs/breadboard/remote";
import {
  PortStreams,
  portToStreams,
} from "../../../breadboard/dist/src/stream";

const TIMEOUT_MS = 5000;

const timeoutAfter = (ms: number): Promise<undefined> => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("Request timed out"));
    }, ms);
  });
};

const getConfigFromParent = (configId: string): Promise<MessagePort> => {
  return new Promise((resolve, reject) => {
    window.addEventListener("message", async (event) => {
      if (event.data === configId && event.ports.length > 0) {
        resolve(event.ports[0]);
      }
      reject(new Error("Invalid iframe proxy entanglement"));
    });
    window.parent.postMessage(configId, "*");
  });
};

class IframeEntangler {
  static #instance: IframeEntangler;
  static instance() {
    if (!IframeEntangler.#instance) {
      IframeEntangler.#instance = new IframeEntangler();
    }
    return IframeEntangler.#instance;
  }

  configId: string | null;
  parentPort: MessagePort | undefined;
  initialized = false;

  constructor() {
    this.configId = new URLSearchParams(window.location.search).get("configId");
  }

  async init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    if (!this.configId) {
      return;
    }
    if (this.parentPort) {
      return;
    }
    try {
      this.parentPort = await Promise.race([
        getConfigFromParent(this.configId),
        timeoutAfter(TIMEOUT_MS),
      ]);
    } catch (e) {
      console.error("Failed to get config from parent", e);
    }
  }

  async getStreams(): Promise<
    PortStreams<AnyProxyResponseMessage, AnyProxyRequestMessage> | undefined
  > {
    if (!this.parentPort) {
      return undefined;
    }
    this.parentPort.start();
    return portToStreams(this.parentPort);
  }
}

export const makeProxyConfig = async () => {
  const entangler = IframeEntangler.instance();
  await entangler.init();
  if (!entangler.parentPort) {
    return [];
  }
  return [
    async (): Promise<Kit | undefined> => {
      const streams = await entangler.getStreams();
      if (!streams) {
        return undefined;
      }
      const proxyClient = new ProxyClient(new WorkerClientTransport(streams));
      return proxyClient.createProxyKit(["runPython"]);
    },
  ];
};
