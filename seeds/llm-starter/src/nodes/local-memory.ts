/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/graph-runner";

const context: string[] = [];

export default async (inputs: InputValues) => {
  Object.entries(inputs).forEach(([key, value]) => {
    context.push(`${key}: ${value}`);
  });
  return { context: context.join("\n") };
};
