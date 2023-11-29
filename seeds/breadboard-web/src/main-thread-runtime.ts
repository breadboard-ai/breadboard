/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Result, Runtime, RuntimeRunResult } from "./types";

import {
  Board,
  InputValues,
  LogProbe,
  OutputValues,
  asRuntimeKit,
} from "@google-labs/breadboard";
import { KitBuilder } from "@google-labs/breadboard/kits";

import Starter from "@google-labs/llm-starter";
import Core from "@google-labs/core-kit";
import PaLMKit from "@google-labs/palm-kit";
import Pinecone from "@google-labs/pinecone-kit";
import NodeNurseryWeb from "@google-labs/node-nursery-web";

export class MainThreadRunResult<MessageType extends Result>
  implements RuntimeRunResult
{
  message: MessageType;
  response?: unknown;

  constructor(message: MessageType) {
    this.message = message;
  }

  reply(reply: unknown) {
    this.response = reply;
  }
}

export type SecretHandler = (keys: {
  keys?: string[];
}) => Promise<OutputValues>;

export class MainThreadRuntime implements Runtime {
  #secretHandler: SecretHandler;

  constructor(secretHandler: SecretHandler) {
    this.#secretHandler = secretHandler;
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
          diagram: runner.mermaid(),
          url: url,
        },
      });

      const SecretAskingKit = new KitBuilder({
        url: "secret-asking-kit ",
      }).build({
        secrets: async (inputs) => {
          return this.#secretHandler(inputs as InputValues);
        },
      });

      const kits = [
        SecretAskingKit,
        Starter,
        Core,
        Pinecone,
        PaLMKit,
        NodeNurseryWeb,
      ].map((kitConstructor) => asRuntimeKit(kitConstructor));

      for await (const stop of runner.run({
        probe: new LogProbe(),
        kits,
      })) {
        const { type } = stop;
        if (type === "input") {
          const { node, inputArguments } = stop;
          const inputResult = new MainThreadRunResult({
            type,
            data: { node, inputArguments },
          });
          yield inputResult;
          stop.inputs = inputResult.response as InputValues;
        } else if (type === "output") {
          const { node, outputs } = stop;
          yield new MainThreadRunResult({ type, data: { node, outputs } });
        } else if (stop.type === "beforehandler") {
          const { node } = stop;
          yield new MainThreadRunResult({ type, data: { node } });
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
