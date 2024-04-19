/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Input, InputWithDefault } from "./internal/board/input.js";
import type { Placeholder } from "./internal/board/placeholder.js";
import type { OutputPortReference } from "./internal/common/port.js";
import type { JsonSerializable } from "./internal/type-system/type.js";

export { board } from "./internal/board/board.js";
export { input } from "./internal/board/input.js";
export { placeholder } from "./internal/board/placeholder.js";
export { serialize } from "./internal/board/serialize.js";
export type {
  // TODO(aomarks) Not quite sure about exporting and/or the name of
  // SerializableBoard.
  SerializableBoard,
} from "./internal/common/serializable.js";
export { defineNodeType } from "./internal/define/define.js";
export type { NodeFactoryFromDefinition } from "./internal/define/node-factory.js";
export { anyOf } from "./internal/type-system/any-of.js";
export { array } from "./internal/type-system/array.js";
export { enumeration } from "./internal/type-system/enumeration.js";
export { object } from "./internal/type-system/object.js";
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
  | Placeholder<T>;
