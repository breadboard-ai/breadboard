/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BreadboardType,
  ConvertBreadboardType,
  JsonSerializable,
} from "../type-system/type.js";

// Neither type nor default
export function input(
  params?: InputParamsWithNeitherTypeNorDefault
): Input<string>;

// Type and default
export function input<T extends BreadboardType>(
  params: InputParamsWithTypeAndDefault<T>
): InputWithDefault<ConvertBreadboardType<T>>;

// Only default
export function input<
  T extends InputParamsWithOnlyDefault<"string" | "number" | "boolean">,
>(params: T): InputWithDefault<BroadenBasicType<T["default"]>>;

// Only type
export function input<T extends InputParamsWithOnlyType<BreadboardType>>(
  params: T
): Input<ConvertBreadboardType<T["type"]>>;

/**
 * Declare an input for a board.
 *
 * @param params
 * @returns
 */
export function input(
  params?: GenericInputParams
): Input<JsonSerializable> | InputWithDefault<JsonSerializable> {
  let type: BreadboardType;
  if (params?.type !== undefined) {
    type = params.type;
  } else if (params?.default !== undefined) {
    switch (typeof params.default) {
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
  } satisfies
    | Omit<Input<JsonSerializable>, "__type">
    | InputWithDefault<JsonSerializable> as
    | Input<JsonSerializable>
    | InputWithDefault<JsonSerializable>;
}

export type GenericSpecialInput =
  | Input<JsonSerializable>
  | InputWithDefault<JsonSerializable>;

export interface Input<T extends JsonSerializable> {
  readonly __SpecialInputBrand: true;
  readonly __type: T;
  readonly type: BreadboardType;
  readonly description?: string;
  readonly default: undefined;
}

export interface InputWithDefault<T extends JsonSerializable> {
  readonly __SpecialInputBrand: true;
  readonly type: BreadboardType;
  readonly description?: string;
  readonly default: T;
}

type GenericInputParams =
  | InputParamsWithNeitherTypeNorDefault
  | InputParamsWithOnlyType<BreadboardType>
  | InputParamsWithOnlyDefault<"string" | "number" | "boolean">
  | InputParamsWithTypeAndDefault<BreadboardType>;

interface InputParamsWithOnlyType<T extends BreadboardType> {
  type: T;
  description?: string;
  default?: undefined;
}

interface InputParamsWithOnlyDefault<
  T extends "string" | "number" | "boolean",
> {
  type?: undefined;
  description?: string;
  default: ConvertBreadboardType<T>;
}

interface InputParamsWithTypeAndDefault<T extends BreadboardType> {
  type: T;
  description?: string;
  default: ConvertBreadboardType<T>;
}

interface InputParamsWithNeitherTypeNorDefault {
  type?: undefined;
  description: string;
  default?: undefined;
}

type BroadenBasicType<T extends string | number | boolean> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : never;
