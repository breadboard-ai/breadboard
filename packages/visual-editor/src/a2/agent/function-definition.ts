/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Outcome, Schema } from "@breadboard-ai/types";
import { z, ZodObject, ZodType } from "zod";
import { FunctionDeclaration, GeminiSchema } from "../a2/gemini.js";

export {
  defineFunction,
  defineFunctionLoose,
  defineResponseSchema,
  mapDefinitions,
  emptyDefinitions,
};

export type MappedDefinitions = {
  definitions: Map<string, FunctionDefinition>;
  declarations: FunctionDeclaration[];
};

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
  [k: string]: ZodType;
};

/**
 * If `isThought` is true, then the status is treated as if it's in the
 * standard Gemini thought format.
 *
 * If `expectedDurationInSec` is specified, it indicates approximately how long
 * this status is expected stay around.
 */
export type StatusUpdateCallbackOptions = {
  isThought?: boolean;
  expectedDurationInSec?: number;
};

/**
 * A callback that allows function handlers to update status of the agent.
 * When the value is `null`, it means that the function handler doesn't want
 * to update the status anymore (and the agent can revert to previous status).
 * Think of it as "clear my status".
 */
export type StatusUpdateCallback = (
  status: string | null,
  options?: StatusUpdateCallbackOptions
) => void;

export type Handler<
  TParams extends ArgsRawShape,
  TResponse extends ArgsRawShape,
> = (
  args: z.infer<ZodObject<TParams>>,
  statusUpdateCallback: StatusUpdateCallback
) => Promise<Outcome<z.infer<ZodObject<TResponse>>>>;

type TypedFunctionDefinition<
  TParams extends ArgsRawShape,
  TResponse extends ArgsRawShape,
> = FunctionDeclaration & {
  handler: Handler<TParams, TResponse>;
};

export type FunctionDefinition = TypedFunctionDefinition<any, any>;

function defineFunction<
  TParams extends ArgsRawShape,
  TResponse extends ArgsRawShape,
>(
  definition: ZodFunctionDefinition<TParams, TResponse>,
  handler: Handler<TParams, TResponse>
): TypedFunctionDefinition<TParams, TResponse> {
  const { parameters, response, name, description } = definition;
  // Convert Zod schemas to JSON Schema
  const parametersJsonSchema = z.object(parameters).toJSONSchema();
  const result: TypedFunctionDefinition<TParams, TResponse> = {
    name,
    description,
    parametersJsonSchema,
    handler,
  };
  if (response) {
    result["responseJsonSchema"] = z.object(response).toJSONSchema();
  }
  return result;
}

function defineResponseSchema<TSchema extends ArgsRawShape>(
  schema: TSchema
): GeminiSchema {
  const responseSchema = z.object(schema).toJSONSchema() as Schema;

  return responseSchema as GeminiSchema;
}

function defineFunctionLoose(
  definition: FunctionDeclaration,
  handler: (
    args: Record<string, unknown>,
    statusUpdateCallback: StatusUpdateCallback
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

function mapDefinitions(functions: FunctionDefinition[]): MappedDefinitions {
  const definitions = new Map<string, FunctionDefinition>(
    functions.map((item) => [item.name!, item])
  );
  const declarations = functions.map(
    ({ handler: _handler, ...rest }) => rest as FunctionDeclaration
  );

  return { definitions, declarations };
}

function emptyDefinitions(): MappedDefinitions {
  return { definitions: new Map(), declarations: [] };
}
