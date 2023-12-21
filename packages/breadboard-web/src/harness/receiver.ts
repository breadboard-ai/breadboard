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
  asyncGen,
  NodeTypeIdentifier,
  asRuntimeKit,
  Kit,
  NodeHandler,
  NodeHandlerContext,
} from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { PaLMKit } from "@google-labs/palm-kit";
import type { ProxyRequestMessage } from "@google-labs/breadboard/worker";

import { SecretKeeper } from "../secrets";
import { KitBuilder } from "@google-labs/breadboard/kits";
import NodeNurseryWeb from "@google-labs/node-nursery-web";
import { SecretHandler } from "./types";

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

type SecretAsker = (ask: AskForSecret) => Promise<void>;

export type ProxyReceiverConfig = {
  proxy: NodeTypeIdentifier[];
  kits: Kit[];
  onSecret: SecretAsker;
};

/**
 * This receiver is intentionally hacky. A real implementation would
 * also need to pick and choose carefully which requests to execute and how.
 * This is just an illustration of how this might be done.
 */
export class ProxyReceiver {
  board: Board;
  handlers?: NodeHandlers;
  secrets = new SecretKeeper();

  constructor(proxy: NodeTypeIdentifier[], secretHandler: SecretHandler) {
    this.board = new Board();
    const kits = [
      asRuntimeKit(Starter),
      asRuntimeKit(PaLMKit),
      asRuntimeKit(NodeNurseryWeb),
    ];
    const onSecret: SecretAsker = async (ask) => {
      console.log("ASKING FOR SECRET", ask);
      const secrets = await secretHandler({ keys: [ask.name] });
      ask.value = secrets[ask.name] as string;
    };
    const proxyNodeHandlers = this.#createProxyNodeHandlers({
      proxy,
      kits,
      onSecret,
    });
    this.board.addKit(
      new KitBuilder({ url: "npm:@google-labs/breadboard-web" }).build({
        ...proxyNodeHandlers,
        secrets: async (inputs: InputValues) => {
          const { keys } = inputs as { keys: string[] };
          return this.secrets.addSecretTokens(keys);
        },
      })
    );
  }

  #createProxyNodeHandlers(
    config: ProxyReceiverConfig
  ): Record<string, NodeHandler> {
    const handlers = config.kits.reduce((handlers, kit) => {
      return { ...kit.handlers, ...handlers };
    }, {} as NodeHandlers);

    return config.proxy.reduce<NodeHandlers>((acc, id) => {
      console.log("CONFIGURING PROXY HANDLER", id);
      const handler = {
        invoke: async (inputs: InputValues, context: NodeHandlerContext) => {
          console.log("INVOKING PROXIED HANDLER", id);
          inputs = await this.#revealSecretsForInput(inputs, config.onSecret);
          console.log("INPUTS for", id, inputs);
          return callHandler(handlers[id], inputs, context);
        },
      } satisfies NodeHandler;
      return { ...acc, [id]: handler };
    }, {} as NodeHandlers);
  }

  async #revealSecretsForInput(
    inputs: InputValues,
    asker: SecretAsker
  ): Promise<InputValues> {
    const results = { ...inputs };
    for (const name in inputs) {
      const value = inputs[name];
      const secrets = this.secrets.findSecrets(value);
      for (const token of secrets) {
        const secret = this.secrets.getSecret(token);
        if (!secret.value) {
          const ask = new AskForSecret(secret.name);
          await asker(ask);
          secret.value = ask.value;
        }
      }
      results[name] = this.secrets.revealSecrets(value, secrets);
    }
    return results;
  }

  async handle(data: ProxyRequestMessage["data"]) {
    const nodeType = data.node.type;
    const inputs = data.inputs;

    if (!this.handlers)
      this.handlers = await Board.handlersFromBoard(this.board);

    const handler = this.handlers[nodeType];
    if (!handler)
      throw new Error(`No handler found for node type "${nodeType}".`);
    return new FinalResult(
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
