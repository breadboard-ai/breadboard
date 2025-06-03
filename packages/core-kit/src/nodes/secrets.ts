/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeHandlerObject } from "@google-labs/breadboard";

type Environment = "node" | "browser" | "worker";

const environment = (): Environment =>
  typeof globalThis.process !== "undefined"
    ? "node"
    : typeof globalThis.window !== "undefined"
      ? "browser"
      : "worker";

type SecretInputs = {
  keys: string[];
};

const getEnvironmentValue = (key: string) => {
  const env = environment();
  if (env === "node") {
    return process.env[key];
  } else if (env === "browser") {
    // How do we avoid namespace clashes?
    return globalThis.localStorage.getItem(key);
  } else if (env === "worker") {
    // TODO: Calling main thread is a general pattern, figure out a way to
    // avoid a special call here. Maybe some Board util?
    throw new Error(
      "Secrets are not yet supported in workers. Please proxy these nodes to the main thread."
    );
  }
};

const requireNonEmpty = (key: string, value?: string | null) => {
  if (!value)
    throw new Error(
      `Key "${key}" was not specified. Please check your environment and make sure it is set.`
    );
  return value;
};

export default {
  metadata: {
    title: "Secrets",
    description: "Retrieves secret values, such as API keys.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-secrets-component",
    },
  },
  describe: async (inputs) => {
    return {
      inputSchema: {
        type: "object",
        properties: {
          keys: {
            type: "array",
            items: { type: "string" },
            title: "Secrets",
            description: "The array of secrets to retrieve from the node.",
            behavior: ["config"],
          },
        },
        required: ["keys"],
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: Object.fromEntries(
          ((inputs as SecretInputs).keys ?? []).map((key) => [
            key,
            { type: "string", title: key },
          ])
        ),
        required: [],
        additionalProperties: false,
      },
    };
  },
  invoke: async (inputs) => {
    const { keys } = inputs as SecretInputs;
    return Object.fromEntries(
      keys.map((key) => [key, requireNonEmpty(key, getEnvironmentValue(key))])
    );
  },
} satisfies NodeHandlerObject;
