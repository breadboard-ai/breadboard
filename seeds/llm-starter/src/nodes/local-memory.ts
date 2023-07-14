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
  // TODO: This is a hack to get around the fact that we don't have a way to
  //       exit the graph when it's cycling indefinitely.
  if (context.length > 10) return { exit: true };
  return { context: context.join("\n") };
};
