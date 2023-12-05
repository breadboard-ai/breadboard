/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Runtime } from "./types";

import {
  Board,
  InputValues,
  LogProbe,
  OutputValues,
  asRuntimeKit,
} from "@google-labs/breadboard";

import Starter from "@google-labs/llm-starter";
import Core from "@google-labs/core-kit";
import PaLMKit from "@google-labs/palm-kit";
import Pinecone from "@google-labs/pinecone-kit";
import NodeNurseryWeb from "@google-labs/node-nursery-web";
import { MainThreadRunResult } from "./main-thread-runtime";
import {
  HTTPClientTransport,
  ProxyClient,
} from "@google-labs/breadboard/remote";

export type SecretHandler = (keys: {
  keys?: string[];
}) => Promise<OutputValues>;

export class ProxyServerRuntime implements Runtime {
  #proxyServerUrl: string;

  constructor(proxyServerUrl: string) {
    this.#proxyServerUrl = proxyServerUrl;
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
        },
      });

      const proxyKit = await proxyClient.createProxyKit([
        "fetch",
        "palm-generateText",
        "palm-embedText",
        "promptTemplate",
        "secrets",
      ]);

      const kits = [
        proxyKit,
        ...[Starter, Core, Pinecone, PaLMKit, NodeNurseryWeb].map(
          (kitConstructor) => asRuntimeKit(kitConstructor)
        ),
      ];

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
