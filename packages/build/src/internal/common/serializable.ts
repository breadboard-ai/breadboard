/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphMetadata } from "@breadboard-ai/types";
import type { GenericBoardDefinition } from "../board/board.js";
import type { Convergence } from "../board/converge.js";
import type {
  GenericSpecialInput,
  Input,
  InputWithDefault,
} from "../board/input.js";
import type { Loopback } from "../board/loopback.js";
import type { Output } from "../board/output.js";
import type { BreadboardType, JsonSerializable } from "../type-system/type.js";
import type { DefaultValue, OutputPortGetter } from "./port.js";

export interface SerializableBoard {
  inputs: Record<
    string,
    | SerializableInputPort
    | Input<JsonSerializable | undefined>
    | InputWithDefault<JsonSerializable | undefined>
  >;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputsForSerialization: any;
  //   | Record<
  //       string,
  //       | SerializableInputPort
  //       | Input<JsonSerializable | undefined>
  //       | InputWithDefault<JsonSerializable | undefined>
  //     >
  //   | Array<
  //       | SerializableInputPort
  //       | Input<JsonSerializable | undefined>
  //       | InputWithDefault<JsonSerializable | undefined>
  //     >;
  outputs: Record<
    string,
    | SerializableOutputPortReference
    | Output<JsonSerializable>
    | Input<JsonSerializable>
    | InputWithDefault<JsonSerializable>
  >;
  outputsForSerialization:
    | Record<
        string,
        | SerializableOutputPortReference
        | Output<JsonSerializable>
        | Input<JsonSerializable>
        | InputWithDefault<JsonSerializable>
      >
    | Array<
        Record<
          string,
          | SerializableOutputPortReference
          | Output<JsonSerializable>
          | Input<JsonSerializable>
          | InputWithDefault<JsonSerializable>
        >
      >;
  id?: string;
  title?: string;
  description?: string;
  version?: string;
  metadata?: GraphMetadata;
  /**
   * A custom describer. It's a separate board that can be
   * used to describe the input and output schemas of this
   * board.
   */
  describer?: GenericBoardDefinition;
}

export interface SerializableNode {
  id?: string;
  type: string;
  inputs: Record<string, SerializableInputPort>;
  metadata?: {
    title?: string;
    description?: string;
    logLevel?: "debug" | "info";
  };
}

export interface SerializableInputPort {
  name: string;
  type: BreadboardType;
  node: SerializableNode;
  value?:
    | JsonSerializable
    | SerializableOutputPortReference
    | GenericSpecialInput
    | Loopback<JsonSerializable>
    | Convergence<JsonSerializable>
    | GenericBoardDefinition
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
