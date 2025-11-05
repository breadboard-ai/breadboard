/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Outcome, Schema } from "@breadboard-ai/types";
import { FunctionDeclaration } from "@google/genai";
import { z, ZodObject, ZodTypeAny } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { GeminiSchema } from "../a2/gemini";

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

export type Describer<TParams extends ArgsRawShape> = (
  args: z.infer<ZodObject<TParams>>
) => string;

type TypedFunctionDefinition<
  TParams extends ArgsRawShape,
  TResponse extends ArgsRawShape,
> = FunctionDeclaration & {
  handler: Handler<TParams, TResponse>;
  describer: Describer<TParams>;
};

export type FunctionDefinition = TypedFunctionDefinition<any, any>;

export { defineFunction, defineFunctionLoose, defineResponseSchema };

function defineFunction<
  TParams extends ArgsRawShape,
  TResponse extends ArgsRawShape,
>(
  definition: ZodFunctionDefinition<TParams, TResponse>,
  handler: Handler<TParams, TResponse>,
  describer: Describer<TParams>
): TypedFunctionDefinition<TParams, TResponse> {
  const { parameters, response, name, description } = definition;
  // Convert Zod schemas to JSON Schema
  const parametersJsonSchema = zodToJsonSchema(z.object(parameters));
  const result: TypedFunctionDefinition<TParams, TResponse> = {
    name,
    description,
    parametersJsonSchema,
    handler,
    describer,
  };
  if (response) {
    result["responseJsonSchema"] = zodToJsonSchema(z.object(response));
  }
  return result;
}

function defineResponseSchema<TSchema extends ArgsRawShape>(
  schema: TSchema
): GeminiSchema {
  const responseSchema = zodToJsonSchema(z.object(schema)) as Schema;

  return responseSchema as GeminiSchema;
}

function defineFunctionLoose(
  definition: FunctionDeclaration,
  handler: (
    args: Record<string, unknown>
  ) => Promise<Outcome<Record<string, unknown>>>,
  describer: (args: Record<string, unknown>) => string
): FunctionDefinition {
  const { parametersJsonSchema, responseJsonSchema, name, description } =
    definition;
  const result: FunctionDefinition = {
    name,
    description,
    parametersJsonSchema,
    handler,
    describer,
  };
  if (responseJsonSchema) {
    result["responseJsonSchema"] = responseJsonSchema;
  }
  return result;
}
