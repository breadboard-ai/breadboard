/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type OutputPortReference } from "../common/port.js";
import type { JsonSerializable } from "../type-system/type.js";
import type { Input, InputWithDefault } from "./input.js";

/**
 * Make it so when there is no value on this port, it will still be possible to
 * invoke connected nodes.
 *
 * In BGL terms, wrapping a Breadboard output port with `optionalEdge` means
 * that any edges connected from that wrapped version of the port will have the
 * `optional` bit set on its BGL `edges` object.
 */
export function optionalEdge<
  T extends
    | OutputPortReference<JsonSerializable>
    | Input<JsonSerializable>
    | InputWithDefault<JsonSerializable>,
>(output: T): T {
  return {
    ...output,
    [OptionalVersionOf]: output,
  };
}

export const OptionalVersionOf = Symbol();

interface Optional {
  [OptionalVersionOf]:
    | OutputPortReference<JsonSerializable>
    | Input<JsonSerializable>
    | InputWithDefault<JsonSerializable>;
}

export function isOptional(value: unknown): value is Optional {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<Optional>)[OptionalVersionOf] !== undefined
  );
}
