/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues } from "../types.js";

import jsonata from "jsonata";

type JsonataInput = {
  expression: string;
  json: unknown;
  raw: boolean;
};

export default async (inputs: InputValues) => {
  const { expression, json, raw } = inputs as JsonataInput;
  if (!expression) throw new Error("Jsonata node requires `expression` input");
  if (!json) throw new Error("Jsonata node requires `json` input");
  const result = await jsonata(expression).evaluate(json);
  return raw ? result : { result };
};
