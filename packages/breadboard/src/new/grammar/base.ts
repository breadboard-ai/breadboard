/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema } from "../../types.js";

import { InputsMaybeAsValues, NodeProxy } from "./types.js";
import {
  InputValues,
  OutputValues,
  NodeHandlerFunction,
} from "../runner/types.js";

import { addNodeType } from "./kits.js";

const reservedWord: NodeHandlerFunction<
  InputValues,
  OutputValues
> = async () => {
  throw new Error("Reserved word handler should never be invoked");
};

// These get added to the default scope
const inputFactory = addNodeType("input", reservedWord);
const outputFactory = addNodeType("output", reservedWord);

export const base = {
  input: (config: { schema?: Schema; $id?: string }) => inputFactory(config),
  output: (config: { schema?: Schema; $id?: string }) => outputFactory(config),
} as {
  input: (<T extends Schema>(
    config: {
      schema: T;
      $id?: string;
    } & InputsMaybeAsValues<T>
  ) => NodeProxy<Record<string, never>, T>) &
    ((
      config?: {
        schema?: Schema;
        $id?: string;
      } & InputsMaybeAsValues<InputValues>
    ) => NodeProxy<InputValues, OutputValues>);
  output: (<T extends Schema>(
    config: {
      schema: T;
      $id?: string;
    } & InputsMaybeAsValues<T>
  ) => NodeProxy<T, Record<string, never>>) &
    ((
      config?: {
        schema?: Schema;
        $id?: string;
      } & InputsMaybeAsValues<InputValues>
    ) => NodeProxy<InputValues, Record<string, never>>);
};
