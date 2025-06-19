/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputStageResult, OutputStageResult, RunResult } from "./run.js";
import type { RunState } from "./run/types.js";
import { loadRunnerState, saveRunnerState } from "./serialization.js";
import type {
  GraphInlineMetadata,
  InputValues,
  NodeDescriptor,
  NodeValue,
  OutputValues,
  TraversalResult,
} from "@breadboard-ai/types";
import type { NodeHandlerContext, RunArguments, Schema } from "./types.js";

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
  path: number[],
  state: RunState = []
): Promise<void> => {
  // If we have no way to bubble up inputs, we just return and not
  // enforce required inputs.
  if (!context.requestInput) return;

  const outputs = result.outputs ?? {};
  const reader = new InputSchemaReader(outputs, result.inputs, path);
  await context.state?.lifecycle().supplyPartialOutputs(outputs, path);
  if (state.length > 0) {
    const last = state[state.length - 1];
    if (last.state) {
      const unpackedState = loadRunnerState(last.state).state;
      unpackedState.partialOutputs = outputs;
      last.state = saveRunnerState("nodestart", unpackedState);
    }
  }
  result.outputs = await reader.read(
    createBubbleHandler(metadata, context, descriptor, state)
  );
};

export const createBubbleHandler = (
  metadata: GraphInlineMetadata,
  context: NodeHandlerContext,
  descriptor: NodeDescriptor,
  state: RunState
) => {
  return (async (propertiesSchema, path) => {
    const entries = Object.entries(propertiesSchema.properties || {});
    const defaultOutputs: OutputValues = {};
    const propertiesToRequest: [string, Schema][] = [];
    // Pre-process the entries and prepare to request input.
    for (const [name, schema] of entries) {
      const required = propertiesSchema.required?.includes(name) ?? false;

      if (required) {
        throw new Error(createErrorMessage(name, metadata, required));
      }
      if (schema.default !== undefined) {
        if ("type" in schema && schema.type !== "string") {
          defaultOutputs[name] = JSON.parse(schema.default);
        } else {
          defaultOutputs[name] = schema.default;
        }
        continue;
      }
      propertiesToRequest.push([name, schema]);
    }
    // Request properties that did not have default values.
    const outputs: OutputValues = {};
    for (const [name, schema] of propertiesToRequest) {
      const value = await context.requestInput?.(
        name,
        schema,
        descriptor,
        path,
        state
      );
      if (context?.signal?.aborted) {
        throw context.signal.throwIfAborted();
      }
      if (value === undefined) {
        throw new Error(createErrorMessage(name, metadata, false));
      }
      outputs[name] = value;
    }
    return { ...defaultOutputs, ...outputs };
  }) satisfies InputSchemaHandler;
};

export type InputSchemaHandler = (
  schema: Schema,
  path: number[]
) => Promise<OutputValues>;

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

    const unfulfilled = structuredClone(schema);
    for (const name of Object.keys(schema.properties)) {
      if (name in this.#currentOutputs) {
        delete unfulfilled.properties?.[name];
      }
    }

    const willAsk = Object.keys(unfulfilled.properties || {}).length > 0;

    const newOutputs = willAsk ? await handler(unfulfilled, this.#path) : {};

    return { ...this.#currentOutputs, ...newOutputs };
  }
}

export class RequestedInputsManager {
  #context: NodeHandlerContext;
  #cache: Map<string, NodeValue> = new Map();

  constructor(args: RunArguments) {
    const { inputs, ...context } = args;
    this.#context = context;
    this.#cache = new Map(inputs ? Object.entries(inputs) : []);
  }

  createHandler(
    next: (result: RunResult) => Promise<void>,
    result: TraversalResult
  ) {
    return async (
      name: string,
      schema: Schema,
      node: NodeDescriptor,
      path: number[],
      state: RunState
    ) => {
      const cachedValue = this.#cache.get(name);
      if (cachedValue !== undefined) return cachedValue;
      const configuration = node.configuration?.schema
        ? {
            configuration: { schema: node.configuration.schema },
          }
        : {};
      const descriptor = { id: node.id, type: node.type, ...configuration };
      const requestInputResult = {
        ...result,
        descriptor,
        inputs: {
          schema: { type: "object", properties: { [name]: schema } },
        },
      };
      await next(new InputStageResult(requestInputResult, state, -1, path));
      const outputs = requestInputResult.outputs;
      let value = outputs && outputs[name];
      if (value === undefined) {
        value = await this.#context.requestInput?.(
          name,
          schema,
          descriptor,
          path,
          state
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
