/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues, OutputValues } from "@google-labs/graph-runner";

const store = new Map<string, unknown>();

export default async (inputs: InputValues) => {
  Object.entries(inputs).forEach(([key, value]) => store.set(key, value));
  return Object.fromEntries(store.entries()) as OutputValues;
};
