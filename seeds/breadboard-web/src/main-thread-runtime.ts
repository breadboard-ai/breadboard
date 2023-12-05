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
import JSONKit from "@google-labs/json-kit";

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
          diagram: runner.mermaid("TD", true),
          url: url,
        },
      });

      const SecretAskingKit = new KitBuilder({
        url: "secret-asking-kit ",
      }).build({
        secrets: async (inputs) => {
          return await this.#secretHandler(inputs as InputValues);
        },
      });

      const kits = [
        SecretAskingKit,
        Starter,
        Core,
        Pinecone,
        PaLMKit,
        NodeNurseryWeb,
        JSONKit,
      ].map((kitConstructor) => asRuntimeKit(kitConstructor));

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
