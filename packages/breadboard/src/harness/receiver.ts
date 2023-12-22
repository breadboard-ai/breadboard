/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { callHandler } from "../handler.js";
import type {
  InputValues,
  NodeHandler,
  NodeHandlerContext,
  NodeHandlers,
} from "../types.js";
import { ProxyRequestMessage } from "../worker/protocol.js";
import { SecretKeeper } from "./secrets.js";
import { HarnessConfig, SecretHandler } from "./types.js";

type ProxyResult = {
  nodeType: string;
  value: unknown;
};

export class ProxyReceiver {
  handlers: NodeHandlers;
  secrets = new SecretKeeper();

  constructor(config: HarnessConfig, onSecret: SecretHandler) {
    const proxyNodeHandlers = this.#createProxyNodeHandlers(config, onSecret);
    this.handlers = {
      ...proxyNodeHandlers,
      secrets: async (inputs: InputValues) => {
        const { keys } = inputs as { keys: string[] };
        return this.secrets.addSecretTokens(keys);
      },
    };
  }

  #createProxyNodeHandlers(
    config: HarnessConfig,
    onSecret: SecretHandler
  ): Record<string, NodeHandler> {
    const handlers = config.kits.reduce((handlers, kit) => {
      return { ...kit.handlers, ...handlers };
    }, {} as NodeHandlers);

    const proxyConfig = config.proxy?.[0].nodes ?? [];
    return proxyConfig.reduce<NodeHandlers>((acc, id) => {
      const nodeType = typeof id === "string" ? id : id.node;
      const handler = {
        invoke: async (inputs: InputValues, context: NodeHandlerContext) => {
          inputs = onSecret
            ? await this.#revealSecretsForInput(inputs, onSecret)
            : inputs;
          return callHandler(handlers[nodeType], inputs, context);
        },
      } satisfies NodeHandler;
      return { ...acc, [nodeType]: handler };
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
