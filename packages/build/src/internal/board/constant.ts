/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OutputPortGetter, type OutputPortReference } from "../common/port.js";
import type { JsonSerializable } from "../type-system/type.js";

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
export function constant<T extends JsonSerializable>(
  output: OutputPortReference<T>
): ConstantOutputValue<T> {
  return {
    [IsConstant]: true,
    [OutputPortGetter]: output[OutputPortGetter],
  };
}

const IsConstant = Symbol();

export interface ConstantOutputValue<T extends JsonSerializable>
  extends OutputPortReference<T> {
  [IsConstant]: true;
}

export function isConstant<T extends JsonSerializable>(
  value: OutputPortReference<T>
): value is ConstantOutputValue<T> {
  return (value as ConstantOutputValue<T>)[IsConstant] === true;
}
