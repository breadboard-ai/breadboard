/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GenericSpecialInput } from "../board/input.js";
import type { Placeholder } from "../board/placeholder.js";
import type { BreadboardType, JsonSerializable } from "../type-system/type.js";
import type { DefaultValue, OutputPortGetter } from "./port.js";

export interface SerializableBoard {
  inputs: Record<string, SerializableInputPort | GenericSpecialInput>;
  outputs: Record<string, SerializableOutputPortReference>;
}

export interface SerializableNode {
  type: string;
  inputs: Record<string, SerializableInputPort>;
}

export interface SerializableInputPort {
  name: string;
  type: BreadboardType;
  node: SerializableNode;
  value?:
    | JsonSerializable
    | SerializableOutputPortReference
    | GenericSpecialInput
    | Placeholder<JsonSerializable>
    | typeof DefaultValue;
}

export interface SerializableOutputPort {
  name: string;
  type: BreadboardType;
  node: SerializableNode;
}

export interface SerializableOutputPortReference {
  [OutputPortGetter]: SerializableOutputPort;
}
