/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import { Schema } from "../types.js";

import {
  InputValues,
  OutputValues,
  InputsMaybeAsValues,
  NodeHandlerFunction,
  OutputValue,
  NodeProxy,
  AbstractValue,
} from "./types.js";

import { addNodeType } from "./default-scope.js";

import { convertZodToSchemaInConfig } from "./zod-utils.js";

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
  input: (config: { schema?: z.ZodType | Schema; $id?: string }) =>
    convertZodToSchemaInConfig(config, inputFactory),
  output: (config: { schema?: z.ZodType | Schema; $id?: string }) =>
    convertZodToSchemaInConfig(config, outputFactory),
} as {
  input: (<T extends OutputValues = OutputValues>(config: {
    schema: z.ZodObject<{
      [K in keyof T]: z.ZodType<T[K]>;
    }>;
    $id?: string;
  }) => NodeProxy<Record<string, never>, T>) &
    ((config: {
      schema?: Schema;
      $id?: string;
    }) => NodeProxy<Record<string, never>, OutputValues>);
  output: (<T extends InputValues>(
    config: {
      schema: z.ZodType<T>;
      $id?: string;
    } & Partial<{
      [K in keyof T]:
        | AbstractValue<T[K]>
        | NodeProxy<InputValues, OutputValue<T[K]>>
        | T[K];
    }>
  ) => NodeProxy<T, Record<string, never>>) &
    ((
      config: {
        schema?: Schema;
        $id?: string;
      } & InputsMaybeAsValues<InputValues>
    ) => NodeProxy<InputValues, Record<string, never>>);
};
