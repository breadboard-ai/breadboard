/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphInlineMetadata,
  InputValues,
  NodeDescriptor,
  NodeHandlerContext,
  NodeValue,
  OutputValues,
  RunArguments,
  RunState,
  Schema,
  TraversalResult,
} from "@breadboard-ai/types";
import { InputStageResult, OutputStageResult, RunResult } from "./run.js";
import { loadRunnerState, saveRunnerState } from "./serialization.js";

export const createErrorMessage = (
  inputName: string | string[],
  metadata: GraphInlineMetadata = {},
  required: boolean
): string => {
  const boardTitle = metadata.title ?? metadata?.url;
  const inputNames = typeof inputName === "string" ? [inputName] : inputName;
  const requiredText = required ? "required " : "";
  return `Missing ${requiredText}input ${inputNames.map((name) => `"${name}"`).join(", ")}${
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
    // Exit early if we already have all properties.
    if (propertiesToRequest.length === 0) {
      return defaultOutputs;
    }
    // Request properties that did not have default values.
    const inputRequestSchema: Schema = {
      properties: Object.fromEntries(propertiesToRequest),
    };
    const outputs = await context.requestInput?.(
      inputRequestSchema,
      descriptor,
      path,
      state
    );
    // If the run was aborted, let's bail
    if (context?.signal?.aborted) {
      throw context.signal.throwIfAborted();
    }
    // Finally, let's make sure we have all values and if not, throw an error.
    if (!outputs || Object.keys(outputs).length === 0) {
      throw new Error(
        createErrorMessage(
          propertiesToRequest.map(([name]) => name),
          metadata,
          false
        )
      );
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
  ): NodeHandlerContext["requestInput"] {
    return async (
      schema: Schema,
      node: NodeDescriptor,
      path: number[],
      state: RunState
    ) => {
      // Retrieve all cached values
      const propertiesToRequest = Object.entries(schema.properties || {});
      const cachedValues: OutputValues = {};
      const uncachedProperties = propertiesToRequest.filter(([name]) => {
        const cachedValue = this.#cache.get(name);
        if (cachedValue !== undefined) {
          cachedValues[name] = cachedValue;
          return false;
        }
        return true;
      });
      // Early return when all properties are cached
      if (uncachedProperties.length === 0) return cachedValues;

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
          schema: {
            type: "object",
            properties: Object.fromEntries(uncachedProperties),
          } satisfies Schema,
        },
      };
      await next(new InputStageResult(requestInputResult, state, -1, path));
      const outputs = requestInputResult.outputs;
      const requestedProperties = schema.properties || {};
      const remainingProperties = outputs
        ? Object.fromEntries(
            Object.entries(requestedProperties).filter(([name]) => {
              return !(name in outputs);
            })
          )
        : requestedProperties;
      if (Object.keys(remainingProperties).length === 0) {
        return outputs;
      }
      // Bubble up: request outer context to request input
      const bubbledOutputs: OutputValues =
        (await this.#context.requestInput?.(
          { properties: remainingProperties },
          descriptor,
          path,
          state
        )) || {};
      // Cache all non-transient properties.
      for (const [name, propertySchema] of uncachedProperties) {
        if (!isTransient(propertySchema)) {
          const value = bubbledOutputs[name];
          if (value) {
            this.#cache.set(name, bubbledOutputs[name]);
          }
        }
      }
      return { ...outputs, ...bubbledOutputs };
    };
  }
}

function isTransient(schema: Schema): boolean {
  return schema.behavior?.includes("transient") ?? false;
}

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
