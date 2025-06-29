/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ClientRunResult } from "@breadboard-ai/types";
import {
  HarnessRunResult,
  InputValues,
  Kit,
  NodeHandler,
  NodeTypeIdentifier,
  OutputValues,
  RunConfig,
  SecretResult,
} from "@breadboard-ai/types";
import { callHandler } from "../handler.js";
import { timestamp } from "../timestamp.js";

/**
 * Get all secret handlers from the given kits.
 * This is used to create a fallback list for secret asking.
 */
const secretHandlersFromKits = (kits: Kit[]): NodeHandler[] => {
  const secretHandlers = [];
  for (const kit of kits) {
    for (const [key, handler] of Object.entries(kit.handlers)) {
      if (key === "secrets") {
        secretHandlers.push(handler);
      }
    }
  }
  return secretHandlers;
};

export const configureSecretAsking = (
  interactiveSecrets: RunConfig["interactiveSecrets"],
  existingKits: Kit[],
  next: (data: HarnessRunResult) => Promise<void>
): Kit[] => {
  if (interactiveSecrets === true) {
    return [createSecretAskingKit(next), ...existingKits];
  } else if (interactiveSecrets === "fallback") {
    return [
      createSecretAskingKit(next, secretHandlersFromKits(existingKits)),
      ...existingKits,
    ];
  } else {
    return existingKits;
  }
};

const interactiveSecretsHandler = (
  next: (result: ClientRunResult<SecretResult>) => Promise<void>
) => {
  return async (inputs: InputValues) => {
    const { keys } = inputs as { keys: string[] };
    if (!keys) return {};
    let outputs = {};
    await next({
      type: "secret",
      data: { keys, timestamp: timestamp() },
      reply: async (value) => {
        outputs = value.inputs;
      },
    });
    return outputs as OutputValues;
  };
};

const fallbackHandler = (
  nodeType: NodeTypeIdentifier,
  handlers: NodeHandler[],
  interactive: NodeHandler
) => {
  const handler: NodeHandler = async (inputs, context) => {
    const { keys } = inputs as { keys: string[] };
    if (!keys) return {};

    // OAuth keys can only be handled interactively.
    const connectionKey =
      keys.length === 1 && keys[0].startsWith("connection:");
    const adjustedHandlers = connectionKey
      ? [interactive]
      : [...handlers, interactive];
    for (const handler of adjustedHandlers) {
      const outputs = await callHandler(handler, inputs, context);
      if (outputs && !outputs["$error"]) {
        return outputs;
      }
    }
    throw new Error(`No handler found for type "${nodeType}"`);
  };
  return handler;
};

export const createSecretAskingKit = (
  next: (result: ClientRunResult<SecretResult>) => Promise<void>,
  fallback?: NodeHandler[]
) => {
  const interactive = interactiveSecretsHandler(next);
  const secrets = fallback
    ? fallbackHandler("secrets", fallback, interactive)
    : interactive;
  const secretAskingKit: Kit = {
    url: "secret-asking-kit",
    handlers: { secrets },
  };
  return secretAskingKit;
};
