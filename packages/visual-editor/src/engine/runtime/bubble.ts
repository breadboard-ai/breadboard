/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  NodeDescriptor,
  NodeHandlerContext,
  NodeValue,
  OutputValues,
  RunArguments,
  Schema,
  TraversalResult,
} from "@breadboard-ai/types";
import { InputStageResult, OutputStageResult, RunResult } from "./run.js";

export { RequestedInputsManager, createOutputProvider };

class RequestedInputsManager {
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
    return async (schema: Schema, node: NodeDescriptor, path: number[]) => {
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
      await next(new InputStageResult(requestInputResult, -1, path));
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
          path
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

const createOutputProvider = (
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
