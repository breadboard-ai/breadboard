/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Harness, HarnessConfig } from "./types";

import {
  Board,
  InputValues,
  LogProbe,
  asRuntimeKit,
} from "@google-labs/breadboard";
import { KitBuilder } from "@google-labs/breadboard/kits";
import { MainThreadRunResult } from "./result";

export class MainThreadHarness implements Harness {
  #config: HarnessConfig;

  constructor(config: HarnessConfig) {
    this.#config = config;
  }

  async *run(url: string) {
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

      const SecretAskingKit = new KitBuilder({
        url: "secret-asking-kit",
      }).build({
        secrets: async (inputs) => {
          return await this.#config.onSecret(inputs as InputValues);
        },
      });

      const kits = [asRuntimeKit(SecretAskingKit), ...this.#config.kits];

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
      let error = e as Error;
      let message = "";
      while (error?.cause) {
        error = (error.cause as { error: Error }).error;
        message += `\n${error.message}`;
      }
      console.error(message, error);
      yield new MainThreadRunResult({ type: "error", data: { error } });
    }
  }
}
