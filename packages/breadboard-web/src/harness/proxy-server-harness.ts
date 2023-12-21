/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Harness, HarnessConfig } from "./types";

import { Board, InputValues, LogProbe } from "@google-labs/breadboard";

import { MainThreadRunResult } from "./result";
import {
  HTTPClientTransport,
  ProxyClient,
} from "@google-labs/breadboard/remote";

export class ProxyServerHarness implements Harness {
  #proxyServerUrl: string;
  #config: HarnessConfig;

  constructor(proxyServerUrl: string, config: HarnessConfig) {
    this.#proxyServerUrl = proxyServerUrl;
    this.#config = config;
  }
  async *run(url: string) {
    const proxyClient = new ProxyClient(
      new HTTPClientTransport(this.#proxyServerUrl)
    );

    try {
      const runner = await Board.load(url);

      yield new MainThreadRunResult({
        type: "load",
        data: {
          title: runner.title,
          description: runner.description,
          version: runner.version,
          diagram: runner.mermaid("TD", true),
          url: url,
          nodes: runner.nodes,
        },
      });

      const proxyKit = proxyClient.createProxyKit(this.#config.proxy);

      const kits = [proxyKit, ...this.#config.kits];

      for await (const data of runner.run({
        probe: new LogProbe(),
        kits,
      })) {
        const { type } = data;
        if (type === "input") {
          const inputResult = new MainThreadRunResult({ type, data });
          yield inputResult;
          data.inputs = inputResult.response as InputValues;
        } else if (type === "output") {
          yield new MainThreadRunResult({ type, data });
        } else if (data.type === "beforehandler") {
          yield new MainThreadRunResult({ type, data });
        }
      }
      yield new MainThreadRunResult({ type: "end", data: {} });
    } catch (e) {
      const error = e as Error;
      console.error(error);
      yield new MainThreadRunResult({ type: "error", data: { error } });
    }
  }
}
