/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputStageResult, OutputStageResult, RunResult } from "./run.js";
import {
  GraphInlineMetadata,
  InputValues,
  NodeDescriptor,
  NodeHandlerContext,
  NodeValue,
  OutputValues,
  Schema,
  TraversalResult,
} from "./types.js";

export const createErrorMessage = (
  inputName: string,
  metadata: GraphInlineMetadata = {},
  required: boolean
): string => {
  const boardTitle = metadata.title ?? metadata?.url;
  const requiredText = required ? "required " : "";
  return `Missing ${requiredText}input "${inputName}"${
    boardTitle ? ` for board "${boardTitle}".` : "."
  }`;
};

export const bubbleUpInputsIfNeeded = async (
  metadata: GraphInlineMetadata,
  context: NodeHandlerContext,
  descriptor: NodeDescriptor,
  result: TraversalResult,
  path: number[]
): Promise<void> => {
  // If we have no way to bubble up inputs, we just return and not
  // enforce required inputs.
  if (!context.requestInput) return;

  const outputs = (await result.outputsPromise) ?? {};
  const reader = new InputSchemaReader(outputs, result.inputs, path);
  result.outputsPromise = reader.read(
    createBubbleHandler(metadata, context, descriptor)
  );
};

export const createBubbleHandler = (
  metadata: GraphInlineMetadata,
  context: NodeHandlerContext,
  descriptor: NodeDescriptor
) => {
  return (async (name, schema, required, path) => {
    if (required) {
      throw new Error(createErrorMessage(name, metadata, required));
    }
    if (schema.default !== undefined) {
      if ("type" in schema && schema.type !== "string") {
        return JSON.parse(schema.default);
      }
      return schema.default;
    }
    const value = await context.requestInput?.(name, schema, descriptor, path);
    if (value === undefined) {
      throw new Error(createErrorMessage(name, metadata, required));
    }
    return value;
  }) satisfies InputSchemaHandler;
};

export type InputSchemaHandler = (
  name: string,
  schema: Schema,
  required: boolean,
  path: number[]
) => Promise<NodeValue>;

export class InputSchemaReader {
  #currentOutputs: OutputValues;
  #inputs: InputValues;
  #path: number[];

  constructor(
    currentOutputs: OutputValues,
    inputs: InputValues,
    path: number[]
  ) {
    this.#currentOutputs = currentOutputs;
    this.#inputs = inputs;
    this.#path = path;
  }

  async read(handler: InputSchemaHandler): Promise<OutputValues> {
    if (!("schema" in this.#inputs)) return this.#currentOutputs;

    const schema = this.#inputs.schema as Schema;

    if (!schema.properties) return this.#currentOutputs;

    const entries = Object.entries(schema.properties);

    const newOutputs: OutputValues = {};
    for (const [name, property] of entries) {
      if (name in this.#currentOutputs) {
        newOutputs[name] = this.#currentOutputs[name];
        continue;
      }
      const required = schema.required?.includes(name) ?? false;
      const value = await handler(name, property, required, this.#path);
      newOutputs[name] = value;
    }

    return {
      ...this.#currentOutputs,
      ...newOutputs,
    };
  }
}

export class RequestedInputsManager {
  #context: NodeHandlerContext;
  #cache: Map<string, NodeValue> = new Map();

  constructor(context: NodeHandlerContext) {
    this.#context = context;
  }

  createHandler(
    next: (result: RunResult) => Promise<void>,
    result: TraversalResult
  ) {
    return async (
      name: string,
      schema: Schema,
      node: NodeDescriptor,
      path: number[]
    ) => {
      const cachedValue = this.#cache.get(name);
      if (cachedValue !== undefined) return cachedValue;
      const descriptor = { id: node.id, type: node.type };
      const requestInputResult = {
        ...result,
        descriptor,
        inputs: {
          schema: { type: "object", properties: { [name]: schema } },
        },
      };
      //console.log("requestInputResult", requestInputResult);
      await next(new InputStageResult(requestInputResult, undefined, -1, path));
      const outputs = await requestInputResult.outputsPromise;
      let value = outputs && outputs[name];
      if (value === undefined) {
        value = await this.#context.requestInput?.(
          name,
          schema,
          descriptor,
          path
        );
      }
      if (!isTransient(schema)) {
        this.#cache.set(name, value);
      }
      return value;
    };
  }
}

const isTransient = (schema: Schema): boolean => {
  return schema.behavior?.includes("transient") ?? false;
};

export const bubbleUpOutputsIfNeeded = async (
  outputs: OutputValues,
  descriptor: NodeDescriptor,
  context: NodeHandlerContext,
  path: number[]
): Promise<boolean> => {
  if (!context.provideOutput) return false;
  const schema = descriptor.configuration?.schema as Schema;
  const shouldBubble = schema?.behavior?.includes("bubble");
  if (!shouldBubble) return false;

  await context.provideOutput(outputs, descriptor, path);
  return true;
};

export const createOutputProvider = (
  next: (result: RunResult) => Promise<void>,
  result: TraversalResult,
  context: NodeHandlerContext
) => {
  if (context.provideOutput) {
    return context.provideOutput;
  }
  return async (
    outputs: OutputValues,
    descriptor: NodeDescriptor,
    path: number[]
  ) => {
    const provideOutputResult = {
      ...result,
      descriptor,
      inputs: outputs,
    };
    await next(new OutputStageResult(provideOutputResult, -1, path));
  };
};
