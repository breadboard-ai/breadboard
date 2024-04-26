/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import type { BroadenBasicType, Defined } from "../common/type-util.js";
import type {
  BreadboardType,
  ConvertBreadboardType,
  JsonSerializable,
} from "../type-system/type.js";

// no parameters
export function input(): Input<string>;

// type and default
export function input<T extends Record<string, unknown>>(
  params: T & { type: Defined; default: Defined } & CheckParams<T>
): InputWithDefault<
  T["type"] extends BreadboardType
    ? ConvertBreadboardType<T["type"]>
    : JsonSerializable
>;

// just type
export function input<T extends Record<string, unknown>>(
  params: T & { type: Defined } & CheckParams<T>
): Input<
  T["type"] extends BreadboardType
    ? ConvertBreadboardType<T["type"]>
    : JsonSerializable
>;

// just default
export function input<T extends Record<string, unknown>>(
  params: T &
    LooseParams & { default: Defined; type?: undefined } & CheckParams<T>
): InputWithDefault<
  T["default"] extends string | number | boolean
    ? BroadenBasicType<T["default"]>
    : JsonSerializable
>;

// just description
export function input(params: {
  description: string;
  type?: undefined;
  default?: undefined;
  examples?: undefined;
}): Input<string>;

// just examples
export function input<T extends Record<string, unknown>>(
  params: T & { examples: Defined } & CheckParams<T>
): Input<
  T["examples"] extends string[] | number[] | boolean[]
    ? BroadenBasicType<T["examples"][number]>
    : JsonSerializable
>;

/**
 * Declare an input for a board.
 */
export function input(
  params?: LooseParams
): Input<JsonSerializable> | InputWithDefault<JsonSerializable> {
  let type: BreadboardType;
  if (params?.type !== undefined) {
    type = params.type;
  } else if (
    params?.default !== undefined ||
    params?.examples?.[0] !== undefined
  ) {
    switch (typeof (params.default ?? params.examples?.[0])) {
      case "string": {
        type = "string";
        break;
      }
      case "number": {
        type = "number";
        break;
      }
      case "boolean": {
        type = "boolean";
        break;
      }
      default: {
        throw new Error(
          `Unknown default type: ${JSON.stringify(params.default)}`
        );
      }
    }
  } else {
    type = "string";
  }
  return {
    __SpecialInputBrand: true,
    type,
    description: params?.description,
    default: params?.default,
    examples: params?.examples,
  } satisfies
    | Omit<Input<JsonSerializable>, "__type">
    | InputWithDefault<JsonSerializable> as
    | Input<JsonSerializable>
    | InputWithDefault<JsonSerializable>;
}

interface LooseParams {
  type?: BreadboardType;
  description?: string;
  default?: JsonSerializable;
  examples?: JsonSerializable[];
}

export interface Input<T extends JsonSerializable> {
  readonly __SpecialInputBrand: true;
  readonly __type: T;
  readonly type: BreadboardType;
  readonly description?: string;
  readonly default: undefined;
  readonly examples?: T[];
}

export interface InputWithDefault<T extends JsonSerializable> {
  readonly __SpecialInputBrand: true;
  readonly type: BreadboardType;
  readonly description?: string;
  readonly default: T;
  readonly examples?: T[];
}

export type GenericSpecialInput =
  | Input<JsonSerializable>
  | InputWithDefault<JsonSerializable>;

type CheckParams<T extends LooseParams> = (T["type"] extends Defined
  ? {
      type: BreadboardType;
      default?: T["type"] extends BreadboardType
        ? ConvertBreadboardType<T["type"]>
        : JsonSerializable;
      examples?: Array<
        T["type"] extends BreadboardType
          ? ConvertBreadboardType<T["type"]>
          : JsonSerializable
      >;
      description?: string;
    }
  : T["default"] extends Defined
    ? {
        type?: never;
        default: string | number | boolean;
        examples?: Array<T["default"]>;
        description?: string;
      }
    : T["examples"] extends Defined
      ? {
          type?: never;
          default?: never;
          examples?: string[] | number[] | boolean[];
          description?: string;
        }
      : never) & {
  [K in keyof T]: K extends "type" | "default" | "examples" | "description"
    ? unknown
    : never;
};
