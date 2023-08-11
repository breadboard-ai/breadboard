/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A kind of input node that provides secret values, such as API keys.
 * Currently, it simply reads them from environment.
 */

import type { InputValues, OutputValues } from "@google-labs/graph-runner";

type Environment = "node" | "browser";
type SecretInputs = {
  keys: string[];
};

const environment = (): Environment => (typeof window !== "undefined") ? "browser" : "node";

const getEnvironmentValue = (key: string) => {
  const env = environment();
  if (env === "node") {
    return process.env[key];
  } else if (env === "browser") {
    // How do we avoid namespace clashes?
    return globalThis.localStorage.getItem(key);
  }
}

export default async (inputs: InputValues) => {
  const { keys = [] } = inputs as SecretInputs;
  return Object.fromEntries(keys.map((key) => [key, getEnvironmentValue(key)])) as OutputValues;
};
