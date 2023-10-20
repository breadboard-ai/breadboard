/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A kind of input node that provides secret values, such as API keys.
 * Currently, it simply reads them from environment.
 */

import type {
  InputValues,
  NodeDescriberFunction,
  NodeHandler,
  OutputValues,
} from "@google-labs/breadboard";

type Environment = "node" | "browser" | "worker";

const environment = (): Environment =>
  typeof globalThis.process !== "undefined"
    ? "node"
    : typeof globalThis.window !== "undefined"
    ? "browser"
    : "worker";

export type SecretInputs = {
  keys: string[];
};

export type SecretWorkerResponse = {
  type: "secret";
  data: string;
};

const getEnvironmentValue = async (key: string) => {
  const env = environment();
  if (env === "node") {
    return process.env[key];
  } else if (env === "browser") {
    // How do we avoid namespace clashes?
    return globalThis.localStorage.getItem(key);
  } else if (env === "worker") {
    // TODO: Calling main thread is a general pattern, figure out a way to
    // avoid a special call here. Maybe some Board util?
    return new Promise<string>((resolve) => {
      self.postMessage({
        type: "secret",
        data: key,
      });
      self.addEventListener("message", (e) => {
        const reply = e.data as SecretWorkerResponse;
        if (!reply.type || reply.type != "secret") return;
        resolve(reply.data);
      });
    });
  }
};

export const requireNonEmpty = (key: string, value?: string | null) => {
  if (!value)
    throw new Error(
      `Key "${key}" was not specified. Please check your environment and make sure it is set.`
    );
  return value;
};

export const secretsDescriber: NodeDescriberFunction = async (
  inputs?: InputValues
) => {
  const { keys } = (inputs ? inputs : {}) as SecretInputs;
  const properties = keys
    ? Object.fromEntries(
        keys.map((key) => [
          key,
          {
            title: key,
          },
        ])
      )
    : {};
  return {
    inputSchema: {
      properties: {
        keys: {
          title: "secrets",
          description: "The array of secrets to retrieve from the node.",
          type: "array",
          items: {
            type: "string",
          },
        },
      },
    },
    outputSchema: {
      properties,
    },
  };
};

export default {
  describe: secretsDescriber,
  invoke: async (inputs: InputValues) => {
    const { keys = [] } = inputs as SecretInputs;
    return Object.fromEntries(
      await Promise.all(
        keys.map(async (key) => [
          key,
          requireNonEmpty(key, await getEnvironmentValue(key)),
        ])
      )
    ) as OutputValues;
  },
} satisfies NodeHandler;
