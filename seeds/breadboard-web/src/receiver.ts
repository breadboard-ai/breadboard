/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type NodeHandlers,
  Board,
  callHandler,
  InputValues,
} from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import type { ProxyRequestMessage } from "@google-labs/breadboard/worker";

import { SecretKeeper } from "./secrets";
import { KitBuilder } from "@google-labs/breadboard/kits";
import { asyncGen } from "./async-gen";
import { NodeNurseryWeb } from "@google-labs/node-nursery-web";

class AskForSecret {
  name: string;
  type = "secret";
  value = "";

  constructor(name: string) {
    this.name = name;
  }
}

class FinalResult {
  nodeType: string;
  value: unknown;
  type = "result";

  constructor(nodeType: string, value: unknown) {
    this.nodeType = nodeType;
    this.value = value;
  }
}

/**
 * This receiver is intentionally hacky. A real implementation would
 * also need to pick and choose carefully which requests to execute and how.
 * This is just an illustration of how this might be done.
 */
export class ProxyReceiver {
  board: Board;
  handlers?: NodeHandlers;
  secrets = new SecretKeeper();

  constructor() {
    this.board = new Board();
    this.board.addKit(
      new KitBuilder({ url: "npm:@google-labs/breadboard-web" }).build({
        secrets: async (inputs: InputValues) => {
          const { keys } = inputs as { keys: string[] };
          return this.secrets.addSecretTokens(keys);
        },
      })
    );
    this.board.addKit(Starter);
    this.board.addKit(NodeNurseryWeb);
  }

  #revealInputSecrets(inputs: InputValues) {
    return asyncGen(async (next) => {
      for (const name in inputs) {
        const value = inputs[name];
        const secrets = this.secrets.findSecrets(value);
        for (const token of secrets) {
          const secret = this.secrets.getSecret(token);
          if (!secret.value) {
            const ask = new AskForSecret(secret.name);
            await next(ask);
            secret.value = ask.value;
          }
        }
        inputs[name] = this.secrets.revealSecrets(value, secrets);
      }
    });
  }

  async *handle(data: ProxyRequestMessage["data"]) {
    const nodeType = data.node.type;
    const inputs = data.inputs;

    if (!this.handlers)
      this.handlers = await Board.handlersFromBoard(this.board);

    yield* this.#revealInputSecrets(inputs);
    const handler = this.handlers[nodeType];
    if (!handler)
      throw new Error(`No handler found for node type "${nodeType}".`);
    yield new FinalResult(
      nodeType,
      await callHandler(handler, inputs, {
        outerGraph: this.board,
        board: this.board,
        descriptor: data.node,
        slots: {},
      })
    );
  }
}
