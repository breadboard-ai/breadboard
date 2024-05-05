/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { array, defineNodeType } from "@breadboard-ai/build";

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

export const requireNonEmpty = (key: string, value?: string | null) => {
  if (!value)
    throw new Error(
      `Key "${key}" was not specified. Please check your environment and make sure it is set.`
    );
  return value;
};

const getKeys = (
  inputs: { keys: string[] } = { keys: [] },
  safe: boolean
): string[] => {
  const { keys } = inputs as SecretInputs;
  if (typeof keys === "string") {
    try {
      return JSON.parse(keys);
    } catch (e) {
      const error = e as Error;
      const message = `Error parsing keys: ${error.message}`;
      if (safe) {
        console.error(message);
        return [];
      }
      throw new Error(message);
    }
  }
  return keys;
};

const secrets = defineNodeType({
  name: "secrets",
  metadata: {
    title: "Secrets",
    description: "Retrieves secret values, such as API keys.",
  },
  inputs: {
    keys: {
      title: "secrets",
      description: "The array of secrets to retrieve from the node.",
      type: array("string"),
    },
  },
  outputs: {
    "*": {
      type: "string",
    },
  },
  describe: (inputs) => ({
    outputs: inputs.keys ?? [],
  }),
  invoke: (inputs) =>
    Object.fromEntries(
      getKeys(inputs, false).map((key) => [
        key,
        requireNonEmpty(key, getEnvironmentValue(key)),
      ])
    ),
});
export default secrets;

/**
 * Create and configure a {@link secrets} node for one secret, and return the
 * corresponding output port.
 */
export function secret(name: string) {
  // TODO(aomarks) Should we replace the `secrets` node with a `secret` node
  // that is monomorphic? Seems simpler.
  return secrets({
    $id: `${name}-secret`,
    keys: [name],
  }).unsafeOutput(name);
}
