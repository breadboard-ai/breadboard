/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues } from "@google-labs/graph-runner";

import jsonata from "jsonata";

export type JsonataOutputs = Record<string, unknown> & {
  result: unknown;
};

export type JsonataInputs = {
  expression: string;
  raw: boolean;
  json?: unknown;
};

export default async (inputs: InputValues) => {
  const { expression, raw, ...rest } = inputs as JsonataInputs;
  if (!expression) throw new Error("Jsonata node requires `expression` input");
  const json = rest.json || rest;
  const result = await jsonata(expression).evaluate(json);
  return raw ? result : { result };
};
