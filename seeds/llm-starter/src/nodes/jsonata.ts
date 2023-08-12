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
  json: unknown;
  raw: boolean;
};

export default async (inputs: InputValues) => {
  const { expression, json, raw } = inputs as JsonataInputs;
  if (!expression) throw new Error("Jsonata node requires `expression` input");
  if (!json) throw new Error("Jsonata node requires `json` input");
  const result = await jsonata(expression).evaluate(json);
  return raw ? result : { result };
};
