/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import { Schema } from "../../types.js";

import { InputsMaybeAsValues, NodeProxy } from "./types.js";
import {
  InputValues,
  OutputValues,
  NodeHandlerFunction,
} from "../runner/types.js";

import { addNodeType } from "./kits.js";
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
  input: (<T extends z.ZodType>(
    config: {
      schema: T;
      $id?: string;
    } & InputsMaybeAsValues<z.infer<T>>
  ) => NodeProxy<Record<string, never>, z.infer<T>>) &
    ((
      config: {
        schema?: Schema;
        $id?: string;
      } & InputsMaybeAsValues<InputValues>
    ) => NodeProxy<InputValues, OutputValues>);
  output: (<T extends z.ZodType>(
    config: {
      schema: T;
      $id?: string;
    } & InputsMaybeAsValues<z.infer<T>>
  ) => NodeProxy<z.infer<T>, Record<string, never>>) &
    ((
      config: {
        schema?: Schema;
        $id?: string;
      } & InputsMaybeAsValues<InputValues>
    ) => NodeProxy<InputValues, Record<string, never>>);
};
