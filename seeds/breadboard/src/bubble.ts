/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeHandlerContext,
  NodeValue,
  OutputValues,
  Schema,
  TraversalResult,
} from "./types.js";

export const createErrorMessage = (
  inputName: string,
  context: NodeHandlerContext
): string => {
  const boardTitle = context.board?.title ?? context.board?.url;
  return `Missing required input "${inputName}"${
    boardTitle ? `for board "${boardTitle}".` : "."
  }`;
};

export const bubbleUpInputsIfNeeded = async (
  context: NodeHandlerContext,
  inputs: InputValues,
  result: TraversalResult
): Promise<void> => {
  // If we have no way to bubble up inputs, we just return and not
  // enforce required inputs.
  if (!context.requestInput) return;

  const outputs = (await result.outputsPromise) ?? {};
  const reader = new InputSchemaReader(outputs, inputs);
  result.outputsPromise = reader.read(async (name, schema, required) => {
    if (required || !context.requestInput) {
      throw new Error(createErrorMessage(name, context));
    }
    return await context.requestInput(name, schema);
  });
};

export type InputSchemaHandler = (
  name: string,
  schema: Schema,
  required: boolean
) => Promise<NodeValue>;

export class InputSchemaReader {
  #currentOutputs: OutputValues;
  #inputs: InputValues;

  constructor(currentOutputs: OutputValues, inputs: InputValues) {
    this.#currentOutputs = currentOutputs;
    this.#inputs = inputs;
  }

  async read(handler: InputSchemaHandler): Promise<OutputValues> {
    if (!("schema" in this.#inputs)) return this.#currentOutputs;

    const schema = this.#inputs.schema as Schema;

    if (!schema.properties) return this.#currentOutputs;

    return {
      ...this.#currentOutputs,
      ...Object.fromEntries(
        await Promise.all(
          Object.entries(schema.properties).map(async ([name, property]) => {
            if (name in this.#currentOutputs)
              return [name, this.#currentOutputs[name]];
            const required = schema.required?.includes(name) ?? false;
            const value = await handler(name, property, required);
            return [name, value];
          })
        )
      ),
    };
  }
}

// if (required) {
//   throw new Error(
//     `Missing required input "${name}" for board "${this.#boardName}"`
//   );
// }
