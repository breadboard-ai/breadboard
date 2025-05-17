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

export default defineNodeType({
  name: "secrets",
  metadata: {
    title: "Secrets",
    description: "Retrieves secret values, such as API keys.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-secrets-component",
    },
  },
  inputs: {
    keys: {
      title: "Secrets",
      description: "The array of secrets to retrieve from the node.",
      type: array("string"),
      behavior: ["config"],
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
  invoke: (inputs) => {
    const { keys } = inputs as SecretInputs;
    return Object.fromEntries(
      keys.map((key) => [key, requireNonEmpty(key, getEnvironmentValue(key))])
    );
  },
});
