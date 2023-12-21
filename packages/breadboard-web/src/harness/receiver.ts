/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type NodeHandlers,
  callHandler,
  InputValues,
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
import NodeNurseryWeb from "@google-labs/node-nursery-web";
import { SecretHandler } from "./types";

type ProxyResult = {
  nodeType: string;
  value: unknown;
};

export type ProxyReceiverConfig = {
  proxy: NodeTypeIdentifier[];
  kits: Kit[];
  onSecret: SecretHandler;
};

/**
 * This receiver is intentionally hacky. A real implementation would
 * also need to pick and choose carefully which requests to execute and how.
 * This is just an illustration of how this might be done.
 */
export class ProxyReceiver {
  handlers: NodeHandlers;
  secrets = new SecretKeeper();

  constructor(proxy: NodeTypeIdentifier[], onSecret: SecretHandler) {
    const kits = [
      asRuntimeKit(Starter),
      asRuntimeKit(PaLMKit),
      asRuntimeKit(NodeNurseryWeb),
    ];
    const proxyNodeHandlers = this.#createProxyNodeHandlers({
      proxy,
      kits,
      onSecret,
    });
    this.handlers = {
      ...proxyNodeHandlers,
      secrets: async (inputs: InputValues) => {
        const { keys } = inputs as { keys: string[] };
        return this.secrets.addSecretTokens(keys);
      },
    };
  }

  #createProxyNodeHandlers(
    config: ProxyReceiverConfig
  ): Record<string, NodeHandler> {
    const handlers = config.kits.reduce((handlers, kit) => {
      return { ...kit.handlers, ...handlers };
    }, {} as NodeHandlers);

    return config.proxy.reduce<NodeHandlers>((acc, id) => {
      const handler = {
        invoke: async (inputs: InputValues, context: NodeHandlerContext) => {
          inputs = await this.#revealSecretsForInput(inputs, config.onSecret);
          return callHandler(handlers[id], inputs, context);
        },
      } satisfies NodeHandler;
      return { ...acc, [id]: handler };
    }, {} as NodeHandlers);
  }

  async #revealSecretsForInput(
    inputs: InputValues,
    secretHandler: SecretHandler
  ): Promise<InputValues> {
    const results = { ...inputs };
    for (const name in inputs) {
      const value = inputs[name];
      const secrets = this.secrets.findSecrets(value);
      for (const token of secrets) {
        const secret = this.secrets.getSecret(token);
        if (!secret.value) {
          const secrets = await secretHandler({ keys: [secret.name] });
          secret.value = secrets[secret.name] as string;
        }
      }
      results[name] = this.secrets.revealSecrets(value, secrets);
    }
    return results;
  }

  async handle(data: ProxyRequestMessage["data"]) {
    const nodeType = data.node.type;
    const inputs = data.inputs;

    const handler = this.handlers[nodeType];
    if (!handler)
      throw new Error(`No handler found for node type "${nodeType}".`);
    return {
      nodeType,
      value: await callHandler(handler, inputs, {
        descriptor: data.node,
        slots: {},
      }),
    } satisfies ProxyResult;
  }
}
