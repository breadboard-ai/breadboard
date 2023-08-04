/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues } from "@google-labs/graph-runner";

export enum ObjectType {
  string,
  array,
  object,
}

type AccumulatorType = string | string[] | Record<string, unknown>;
type ValueType = string | Record<string, unknown>;

type AppendInputValues = Record<string, unknown> & {
  accumulator: AccumulatorType;
};

export const getObjectType = (value: unknown): ObjectType => {
  if (value === null) return ObjectType.string;
  const type = typeof value;
  if (["string", "number", "boolean", "bigint"].includes(type))
    return ObjectType.string;
  if (Array.isArray(value)) return ObjectType.array;
  return ObjectType.object;
};

const asArray = (values: ValueType): string[] => {
  return Object.entries(values).map(([k, v]) => `${k}: ${v}`);
};

const asString = (values: ValueType): string => {
  return asArray(values).join("\n");
};

export default async (inputs: InputValues) => {
  const { accumulator, ...values } = inputs as AppendInputValues;
  if (Object.keys(values).length === 0) return { accumulator };
  const type = getObjectType(accumulator);
  switch (type) {
    case ObjectType.string:
      return { accumulator: `${accumulator}\n${asString(values)}` };
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
};
