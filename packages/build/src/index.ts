/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { isConvergence, type Convergence } from "./internal/board/converge.js";
import {
  isSpecialInput,
  type Input,
  type InputWithDefault,
} from "./internal/board/input.js";
import { isLoopback, type Loopback } from "./internal/board/loopback.js";
import {
  isOutputPortReference,
  OutputPortGetter,
  type OutputPortReference,
} from "./internal/common/port.js";
import { anyOf } from "./internal/type-system/any-of.js";
import type {
  BreadboardType,
  JsonSerializable,
} from "./internal/type-system/type.js";

export { board } from "./internal/board/board.js";
export { constant } from "./internal/board/constant.js";
export { converge } from "./internal/board/converge.js";
export { input } from "./internal/board/input.js";
export { loopback } from "./internal/board/loopback.js";
export { optionalEdge } from "./internal/board/optional.js";
export { output } from "./internal/board/output.js";
export { serialize } from "./internal/board/serialize.js";
export { unsafeCast } from "./internal/board/unsafe-cast.js";
export type {
  // TODO(aomarks) Not quite sure about exporting and/or the name of
  // SerializableBoard.
  SerializableBoard,
} from "./internal/common/serializable.js";
export { defineNodeType } from "./internal/define/define.js";
export { jsonSchemaToPortConfigMap as fromJSONSchema } from "./internal/define/json-schema.js";
export type { NodeFactoryFromDefinition } from "./internal/define/node-factory.js";
export { unsafeSchema } from "./internal/define/unsafe-schema.js";
export { kit } from "./internal/kit.js";
export { annotate } from "./internal/type-system/annotate.js";
export { anyOf } from "./internal/type-system/any-of.js";
export { array } from "./internal/type-system/array.js";
export { enumeration } from "./internal/type-system/enumeration.js";
export { object, optional } from "./internal/type-system/object.js";
export { toJSONSchema } from "./internal/type-system/type.js";
export { unsafeType } from "./internal/type-system/unsafe.js";

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
