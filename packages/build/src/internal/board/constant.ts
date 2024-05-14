/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type OutputPortReference } from "../common/port.js";
import type { JsonSerializable } from "../type-system/type.js";
import type { Input, InputWithDefault } from "./input.js";

// TODO(aomarks) Possible other names: `sticky`, `persistent`, `retained`.
// `memoized` was also used previously, but that makes me think of caching which
// is performance-oriented, whereas this actually affects functional control
// flow). We're using `constant` for now though because it's nice to be be
// consistent with BGL.

/**
 * Cause a value to be retained indefinitely during Breadboard execution,
 * instead of the default behavior where it is consumed.
 *
 * In BGL terms, wrapping a Breadboard output port with `constant` means that
 * any edges connected from that wrapped version of the port will have the
 * `constant` bit set on its BGL `edges` object.
 */
export function constant<
  T extends
    | OutputPortReference<JsonSerializable>
    | Input<JsonSerializable>
    | InputWithDefault<JsonSerializable>,
>(output: T): T {
  return {
    ...output,
    [ConstantVersionOf]: output,
  };
}

export const ConstantVersionOf = Symbol();

interface Constant {
  [ConstantVersionOf]:
    | OutputPortReference<JsonSerializable>
    | Input<JsonSerializable>
    | InputWithDefault<JsonSerializable>;
}

export function isConstant(value: unknown): value is Constant {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<Constant>)[ConstantVersionOf] !== undefined
  );
}
