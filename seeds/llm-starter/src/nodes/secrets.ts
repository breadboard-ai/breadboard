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

export type SecretInputs = {
  keys: string[];
};

const environment = (): Environment =>
  typeof window !== "undefined" ? "browser" : "node";

const getEnvironmentValue = (key: string) => {
  const env = environment();
  if (env === "node") {
    return process.env[key];
  } else if (env === "browser") {
    // How do we avoid namespace clashes?
    return globalThis.localStorage.getItem(key);
  }
};

export const requireNonEmpty = (key: string, value?: string | null) => {
  if (!value)
    throw new Error(
      `Key "${key}" was not specified. Please check your environment and make sure it is set.`
    );
  return value;
};

export default async (inputs: InputValues) => {
  const { keys = [] } = inputs as SecretInputs;
  return Object.fromEntries(
    keys.map((key) => [key, requireNonEmpty(key, getEnvironmentValue(key))])
  ) as OutputValues;
};
