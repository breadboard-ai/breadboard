/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues } from "@google-labs/graph-runner";

export enum ObjectType {
  stringy,
  array,
  object,
}

type AccumulatorType = string | string[] | Record<string, unknown>;
type ValueType = string | Record<string, unknown>;

type AppendInputValues = Record<string, unknown> & {
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

export default async (inputs: InputValues) => {
  const { accumulator, ...values } = inputs as AppendInputValues;
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
};
