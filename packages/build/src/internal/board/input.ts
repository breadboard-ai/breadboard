/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import type { BroadenBasicType, Defined } from "../common/type-util.js";
import { defineNodeType } from "../define/define.js";
import { jsonSchema } from "../type-system/json-schema.js";
import type {
  BreadboardType,
  ConvertBreadboardType,
  JsonSerializable,
} from "../type-system/type.js";

type Optionalize<
  T extends Record<string, unknown>,
  X extends JsonSerializable | undefined,
> = T["optional"] extends true ? X | undefined : X;

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
  Optionalize<
    T,
    T["type"] extends BreadboardType
      ? ConvertBreadboardType<T["type"]>
      : JsonSerializable
  >
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

// string by default (required)
export function input(params: {
  $id?: string;
  description?: string;
  title?: string;
  type?: undefined;
  default?: undefined;
  examples?: undefined;
  optional?: undefined;
}): Input<string>;

// string by default (optional)
export function input(params: {
  $id?: string;
  description?: string;
  title?: string;
  type?: undefined;
  default?: undefined;
  examples?: undefined;
  optional: true;
}): Input<string | undefined>;

// just examples
export function input<T extends Record<string, unknown>>(
  params: T & { examples: Defined } & CheckParams<T>
): Input<
  Optionalize<
    T,
    T["examples"] extends string[] | number[] | boolean[]
      ? BroadenBasicType<T["examples"][number]>
      : JsonSerializable
  >
>;

/**
 * Declare an input for a board.
 */
export function input(
  params?: LooseParams
): Input<JsonSerializable | undefined> | InputWithDefault<JsonSerializable> {
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
    id: params?.$id,
    type,
    title: params?.title,
    description: params?.description,
    default: params?.default,
    examples: params?.examples,
    optional: params?.optional,
  } satisfies
    | Omit<Input<JsonSerializable>, "__type">
    | InputWithDefault<JsonSerializable> as
    | Input<JsonSerializable>
    | InputWithDefault<JsonSerializable>;
}

interface LooseParams {
  $id?: string;
  type?: BreadboardType;
  title?: string;
  description?: string;
  default?: JsonSerializable;
  examples?: JsonSerializable[];
  optional?: true;
}

export interface Input<T extends JsonSerializable | undefined> {
  readonly __SpecialInputBrand: true;
  readonly __type: T;
  readonly id?: string;
  readonly type: BreadboardType;
  readonly title?: string;
  readonly description?: string;
  readonly default: undefined;
  readonly examples?: T[];
  readonly optional?: boolean;
}

export interface InputWithDefault<T extends JsonSerializable | undefined> {
  readonly __SpecialInputBrand: true;
  readonly id?: string;
  readonly title?: string;
  readonly type: BreadboardType;
  readonly description?: string;
  readonly default: T;
  readonly examples?: T[];
}

export type GenericSpecialInput =
  | Input<JsonSerializable | undefined>
  | InputWithDefault<JsonSerializable>;

type CheckParams<T extends LooseParams> = (T["type"] extends Defined
  ? {
      $id?: string;
      type: BreadboardType;
      title?: string;
      default?: T["type"] extends BreadboardType
        ? ConvertBreadboardType<T["type"]>
        : JsonSerializable;
      examples?: Array<
        T["type"] extends BreadboardType
          ? ConvertBreadboardType<T["type"]>
          : JsonSerializable
      >;
      description?: string;
      optional?: T["default"] extends Defined ? never : true;
    }
  : T["default"] extends Defined
    ? {
        $id?: string;
        type?: never;
        title?: string;
        default: string | number | boolean;
        examples?: Array<T["default"]>;
        description?: string;
        optional?: never;
      }
    : T["examples"] extends Defined
      ? {
          $id?: string;
          type?: never;
          title?: string;
          default?: never;
          examples?: string[] | number[] | boolean[];
          description?: string;
          optional?: true;
        }
      : never) & {
  [K in keyof T]: K extends
    | "$id"
    | "type"
    | "title"
    | "default"
    | "examples"
    | "description"
    | "optional"
    ? unknown
    : never;
};

export function isSpecialInput(value: unknown): value is GenericSpecialInput {
  return (
    typeof value === "object" &&
    value !== null &&
    "__SpecialInputBrand" in value
  );
}

/**
 * Usually, inputs are created with the {@link input} and {@link inputNode}
 * functions, which abstract Breadboard inputs to make them more powerful and
 * ergonomic while using the Build API.
 *
 * This `rawInput` function, in contrast, creates an input component that
 * behaves like a totally normal component that happens to have the type
 * "input".
 *
 * This gives you full freedom to wire an input node up in arbitrary ways in a
 * board, for example if you need the schema to be provided by the output of
 * another component, rather than being statically defined.
 *
 * Note that you will need to use {@link unsafeOutput} to access any output
 * ports of this component.
 */
export const rawInput = defineNodeType({
  name: "input",
  inputs: {
    schema: {
      type: jsonSchema,
    },
  },
  outputs: {
    "*": {
      type: "unknown",
    },
  },
  describe: () => {
    // TODO(aomarks) Replace this with Breadboard interfaces when they exist.
    //
    // These definitions are stubs. They exist only so that we have a way to
    // declare input and output nodes using the Build API. Every runtime is
    // responsible for providing its own real implementation of "input" and
    // "output". So,  we throw here and below in case this implementations
    // somehow make their way into a runtime environment.
    throw new Error("Unexpected call to stub input describe()");
  },
  invoke: () => {
    throw new Error("Unexpected call to stub input invoke()");
  },
});
