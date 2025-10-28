/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Outcome } from "@breadboard-ai/types";
import { FunctionDeclaration } from "@google/genai";
import { z, ZodObject, ZodTypeAny } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

export type ZodFunctionDefinition<
  TParams extends ArgsRawShape,
  TResponse extends ArgsRawShape,
> = {
  name: string;
  description: string;
  parameters: TParams;
  response?: TResponse;
};

type ArgsRawShape = {
  [k: string]: ZodTypeAny;
};

export type Handler<
  TParams extends ArgsRawShape,
  TResponse extends ArgsRawShape,
> = (
  args: z.infer<ZodObject<TParams>>
) => Promise<Outcome<z.infer<ZodObject<TResponse>>>>;

type TypedFunctionDefinition<
  TParams extends ArgsRawShape,
  TResponse extends ArgsRawShape,
> = FunctionDeclaration & {
  handler: Handler<TParams, TResponse>;
};

export type FunctionDefinition = TypedFunctionDefinition<any, any>;

export { defineFunction, defineFunctionLoose };

function defineFunction<
  TParams extends ArgsRawShape,
  TResponse extends ArgsRawShape,
>(
  definition: ZodFunctionDefinition<TParams, TResponse>,
  handler: Handler<TParams, TResponse>
): TypedFunctionDefinition<TParams, TResponse> {
  const { parameters, response, name, description } = definition;
  // Convert Zod schemas to JSON Schema
  const parametersJsonSchema = zodToJsonSchema(z.object(parameters));
  const result: TypedFunctionDefinition<TParams, TResponse> = {
    name,
    description,
    parametersJsonSchema,
    handler,
  };
  if (response) {
    result["responseJsonSchema"] = zodToJsonSchema(z.object(response));
  }
  return result;
}

function defineFunctionLoose(
  definition: FunctionDeclaration,
  handler: (
    args: Record<string, unknown>
  ) => Promise<Outcome<Record<string, unknown>>>
): FunctionDefinition {
  const { parametersJsonSchema, responseJsonSchema, name, description } =
    definition;
  const result: FunctionDefinition = {
    name,
    description,
    parametersJsonSchema,
    handler,
  };
  if (responseJsonSchema) {
    result["responseJsonSchema"] = responseJsonSchema;
  }
  return result;
}
