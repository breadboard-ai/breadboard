/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeDescriberFunction,
  NodeHandler,
  NodeValue,
  OutputValues,
  Schema,
} from "@google-labs/breadboard";

export enum ObjectType {
  stringy,
  array,
  object,
}

type AccumulatorType = string | string[] | Record<string, NodeValue>;
type ValueType = string | Record<string, NodeValue>;

export type AppendInputs = Record<string, NodeValue> & {
  accumulator: AccumulatorType;
};

export type AppendOutputs = {
  accumulator: AccumulatorType;
};

export const getObjectType = (value: unknown): ObjectType => {
  if (value === null || value === undefined) return ObjectType.stringy;
  const type = typeof value;
  if (["string", "number", "boolean", "bigint"].includes(type))
    return ObjectType.stringy;
  if (Array.isArray(value)) return ObjectType.array;
  return ObjectType.object;
};

const asArray = (values: ValueType): string[] => {
  return Object.entries(values).map(([k, v]) => {
    const value =
      getObjectType(v) === ObjectType.stringy ? v : JSON.stringify(v);
    return `${k}: ${value}`;
  });
};

const asString = (values: ValueType): string => {
  return asArray(values).join("\n");
};

export const computeInputSchema = (incomingWires: Schema): Schema => {
  type SchemaProperties = Schema["properties"];
  const properties: SchemaProperties = {
    accumulator: {
      title: "accumulator",
      description:
        "A string, an object, or an array to which other input values will be appended.",
      type: ["array", "object", "string"],
      items: { type: "string" },
    },
  };
  const inputSchema = { properties, additionalProperties: true };

  if (!incomingWires.properties) return inputSchema;

  Object.entries(incomingWires.properties).forEach(([propertyName, schema]) => {
    properties[propertyName] = schema;
  });
  return inputSchema;
};

export const appendDescriber: NodeDescriberFunction = async (
  _inputs?: InputValues,
  incomingWires?: Schema
) => {
  const inputSchema = computeInputSchema(incomingWires || {});
  return {
    inputSchema,
    outputSchema: {
      properties: {
        accumulator: {
          title: "accumulator",
          description:
            "The result of appending. This is input `accumulator` with the provided values appended to it.",
        },
      },
    },
  };
};

export default {
  describe: appendDescriber,
  invoke: async (inputs: InputValues): Promise<OutputValues> => {
    const { accumulator, ...values } = inputs as AppendInputs;
    if (Object.keys(values).length === 0) return { accumulator };
    const type = getObjectType(accumulator);
    switch (type) {
      case ObjectType.stringy: {
        const stringy =
          accumulator === null || accumulator === undefined
            ? ""
            : `${accumulator}\n`;
        return { accumulator: `${stringy}${asString(values)}` };
      }
      case ObjectType.array:
        return {
          accumulator: [...(accumulator as string[]), ...asArray(values)],
        };
      case ObjectType.object:
        return {
          accumulator: {
            ...(accumulator as object),
            ...values,
          },
        };
    }
  },
} satisfies NodeHandler;
