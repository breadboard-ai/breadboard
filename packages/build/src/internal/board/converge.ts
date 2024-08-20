/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { brand, isBranded } from "../common/brand.js";
import type { OutputPortReference } from "../common/port.js";
import type { BroadenBasicType } from "../common/type-util.js";
import type { JsonSerializable } from "../type-system/type.js";
import type { Input, InputWithDefault } from "./input.js";
import type { Loopback } from "./loopback.js";

type Convergable<T extends JsonSerializable> =
  | T
  | OutputPortReference<T>
  | Input<T>
  | InputWithDefault<T>
  | Loopback<T>;

export function converge<
  A extends Convergable<JsonSerializable>,
  B extends Convergable<JsonSerializable>,
  C extends Array<Convergable<JsonSerializable>>,
>(
  first: A,
  second: B,
  ...rest: C
): Convergence<ExtractType<A | B | C[number]>> {
  return {
    [brand]: "Convergence",
    ports: [first, second, ...rest] as Array<
      Convergable<ExtractType<A | B | C[number]>>
    >,
  };
}

type ExtractType<T extends Convergable<JsonSerializable>> =
  T extends Convergable<infer X>
    ? X extends string | number | boolean
      ? BroadenBasicType<X>
      : X
    : never;

export interface Convergence<T extends JsonSerializable = JsonSerializable> {
  readonly [brand]: "Convergence";
  ports: Array<Convergable<T>>;
}

export function isConvergence(value: unknown): value is Convergence {
  return isBranded(value, "Convergence");
}
