/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { isConvergence, type Convergence } from "../board/converge.js";
import {
  isSpecialInput,
  type Input,
  type InputWithDefault,
} from "../board/input.js";
import { isLoopback, type Loopback } from "../board/loopback.js";
import { anyOf } from "../type-system/any-of.js";
import {
  type BreadboardType,
  type JsonSerializable,
} from "../type-system/type.js";
import {
  isOutputPortReference,
  OutputPortGetter,
  type OutputPortReference,
} from "./port.js";

/**
 * A value, or something that can stand-in for a value when wiring together
 * boards.
 *
 * For example, for a string, this could be any of:
 *
 * - An actual string.
 * - A string-typed output port.
 * - A node with a primary string-typed output port.
 * - A string-typed `input`.
 */
export type Value<T extends JsonSerializable> =
  | T
  | OutputPortReference<T>
  | Input<T>
  | InputWithDefault<T>
  | Loopback<T>
  | Convergence<T>;

/**
 * Given a Breadboard {@link Value}, determine its JSON Schema type.
 */
export function extractTypeFromValue(
  value: Value<JsonSerializable>
): BreadboardType {
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (value === null) {
    return "null";
  }
  if (isOutputPortReference(value)) {
    return value[OutputPortGetter].type;
  }
  if (isSpecialInput(value)) {
    return value.type;
  }
  if (isLoopback(value)) {
    return value.type;
  }
  if (isConvergence(value)) {
    return anyOf(
      ...(value.ports.map((port) => extractTypeFromValue(port)) as [
        BreadboardType,
        BreadboardType,
        ...BreadboardType[],
      ])
    );
  }
  return "unknown";
}
