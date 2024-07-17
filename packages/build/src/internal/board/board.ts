/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeDescriberResult, Schema } from "@google-labs/breadboard";
import type { GraphMetadata } from "@google-labs/breadboard-schema/graph.js";
import type { JSONSchema4 } from "json-schema";
import {
  InputPort,
  OutputPort,
  OutputPortGetter,
  type OutputPortReference,
  type ValuesOrOutputPorts,
} from "../common/port.js";
import type {
  SerializableInputPort,
  SerializableOutputPortReference,
} from "../common/serializable.js";
import { toJSONSchema, type JsonSerializable } from "../type-system/type.js";
import {
  isSpecialInput,
  type GenericSpecialInput,
  type Input,
  type InputWithDefault,
} from "./input.js";
import { isOptional } from "./optional.js";
import { isSpecialOutput, type Output } from "./output.js";

// TODO(aomarks) Support primary ports in boards.
// TODO(aomarks) Support adding descriptions to board ports.

/**
 * Define a new Breadboard board.
 *
 * Example usage:
 *
 * ```ts
 * export const recipeMaker = board({
 *   inputs: {recipeName},
 *   outputs: {recipe: llmRecipeResult}
 * });
 * ```
 *
 * @param inputs The input ports that should be exposed from nodes in the board
 * and under which name. An object that maps from an exposed port name to an
 * input port from a node in the board.
 * @param output The output ports that should be exposed from nodes in the board
 * and under which name. An object that maps from an exposed port name to an
 * output port from a node in the board.
 * @return A {@link BoardDefinition} which can be serialized for execution or
 * distribution, and which can be instantiated for composition into another
 * board.
 */
export function board<
  // TODO(aomarks) Does it actually make any sense to pass an input port
  // directly here? The only way to not have already initialized it to something
  // was to have used an input(), so only inputs should be allowed, right?
  IPORTS extends BoardInputShape,
  OPORTS extends BoardOutputShape,
>({
  inputs,
  outputs,
  id,
  title,
  description,
  version,
  metadata,
}: BoardParameters<IPORTS, OPORTS>): BoardDefinition<
  FlattenMultiInputs<IPORTS>,
  FlattenMultiOutputs<OPORTS>
> {
  const flatInputs = flattenInputs(inputs);
  const flatOutputs = flattenOutputs(outputs);
  const def = new BoardDefinitionImpl(flatInputs, flatOutputs);
  return Object.assign(def.instantiate.bind(def), {
    id,
    inputs: flatInputs,
    inputsForSerialization: inputs as BoardInputPorts | Array<BoardInputPorts>,
    outputs: flatOutputs,
    outputsForSerialization: outputs as
      | BoardOutputPorts
      | Array<BoardOutputPorts>,
    title,
    description,
    version,
    metadata,
    isBoard: true,
    describe: def.describe.bind(def),
  });
}

function flattenInputs<IPORTS extends BoardInputShape>(
  inputs: IPORTS
): FlattenMultiInputs<IPORTS> {
  if (!Array.isArray(inputs)) {
    return inputs as FlattenMultiInputs<IPORTS>;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ports = {} as any;
  for (const inputNode of inputs as Array<BoardInputPorts>) {
    for (const [name, port] of Object.entries(inputNode)) {
      // TODO(aomarks) This is wrong. We're just clobbering. Doesn't matter up
      // until we try to invoke a board, which we don't yet support.
      ports[name] = port;
    }
  }
  return ports;
}

function flattenOutputs<OPORTS extends BoardOutputShape>(
  outputs: OPORTS
): FlattenMultiOutputs<OPORTS> {
  if (!Array.isArray(outputs)) {
    return outputs as FlattenMultiOutputs<OPORTS>;
  }
  const ports = {} as FlattenMultiOutputs<OPORTS>;
  for (const outputNode of outputs as Array<BoardOutputPorts>) {
    for (const [name, port] of Object.entries(outputNode)) {
      // TODO(aomarks) This is wrong. We're just clobbering. Doesn't matter up
      // until we try to invoke a board, which we don't yet support.
      ports[name] = port;
    }
  }
  return ports;
}

export type FlattenMultiInputs<I extends BoardInputShape> =
  I extends Array<BoardInputPortsWithUndefined>
    ? {
        [K in keyof I[number] as K extends "$id" | "$metadata"
          ? never
          : K]-?: I[number][K] extends Input<infer T> | undefined
          ? undefined extends I[number][K]
            ? Input<T | undefined>
            : Input<T>
          : never;
      }
    : I;

type FlattenMultiOutputs<O extends BoardOutputShape> =
  O extends Array<BoardOutputPortsWithUndefined>
    ? {
        [K in keyof O[number] as K extends "$id" | "$metadata"
          ? never
          : K]-?: O[number][K] extends OutputPort<infer T> | undefined
          ? undefined extends O[number][K]
            ? OutputPort<T | undefined>
            : OutputPort<T>
          : O[number][K] extends OutputPortReference<infer T> | undefined
            ? undefined extends O[number][K]
              ? OutputPortReference<T | undefined>
              : OutputPortReference<T>
            : never;
      }
    : O;

export interface BoardParameters<
  IPORTS extends BoardInputShape,
  OPORTS extends BoardOutputShape,
> {
  inputs: IPORTS;
  outputs: OPORTS;
  id?: string;
  title?: string;
  description?: string;
  version?: string;
  metadata?: GraphMetadata;
}

export type BoardInputShape =
  | BoardInputPorts
  | Array<BoardInputPortsWithUndefined>;

export type BoardInputPorts = Record<
  string,
  InputPort<JsonSerializable> | GenericSpecialInput
>;

export type BoardInputPortsWithUndefined = Record<
  string,
  | InputPort<JsonSerializable>
  | GenericSpecialInput
  | string
  | undefined
  | { title?: string; description?: string }
> & {
  $id?: string | undefined;
  $metadata?: { title?: string; description?: string; icon?: string };
};

export type BoardOutputShape =
  | BoardOutputPorts
  | Array<BoardOutputPortsWithUndefined>;

export type BoardOutputPorts = Record<
  string,
  | OutputPortReference<JsonSerializable>
  | Output<JsonSerializable>
  | Input<JsonSerializable>
  | InputWithDefault<JsonSerializable>
>;

export type BoardOutputPortsWithUndefined = Record<
  string,
  | OutputPortReference<JsonSerializable>
  | Output<JsonSerializable>
  | string
  | { title?: string; description?: string }
  | undefined
> & {
  $id?: string | undefined;
  $metadata?: { title?: string; description?: string; icon?: string };
};

export type BoardDefinition<
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> = BoardInstantiateFunction<IPORTS, OPORTS> & {
  readonly id?: string;
  readonly inputs: IPORTS;
  readonly inputsForSerialization: BoardInputPorts | Array<BoardInputPorts>;
  readonly outputs: OPORTS;
  readonly outputsForSerialization: BoardOutputPorts | Array<BoardOutputPorts>;
  readonly title?: string;
  readonly description?: string;
  readonly version?: string;
  readonly metadata?: GraphMetadata;
  describe(): Promise<NodeDescriberResult>;
};

// TODO(aomarks) Fix this definition so that it doesn't need <any, any>.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GenericBoardDefinition = BoardDefinition<any, any>;

type BoardInstantiateFunction<
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> = (
  values: ValuesOrOutputPorts<ExtractPortTypes<IPORTS>>
) => BoardInstance<IPORTS, OPORTS>;

class BoardDefinitionImpl<
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> {
  readonly #inputs: IPORTS;
  readonly #outputs: OPORTS;

  constructor(inputs: IPORTS, outputs: OPORTS) {
    this.#inputs = inputs;
    this.#outputs = outputs;
  }

  instantiate(
    values: ValuesOrOutputPorts<ExtractPortTypes<IPORTS>>
  ): BoardInstance<IPORTS, OPORTS> {
    return new BoardInstance(this.#inputs, this.#outputs, values);
  }

  async describe(): Promise<NodeDescriberResult> {
    const requiredInputs: string[] = [];
    const requiredOutputs: string[] = [];
    return {
      inputSchema: {
        type: "object",
        required: requiredInputs,
        additionalProperties: false,
        properties: Object.fromEntries(
          Object.entries(this.#inputs).map(([name, input]) => {
            const { schema, required } = describeInput(input);
            if (required) {
              requiredInputs.push(name);
            }
            return [name, schema as Schema];
          })
        ),
      },
      outputSchema: {
        type: "object",
        required: requiredOutputs,
        additionalProperties: false,
        properties: Object.fromEntries(
          Object.entries(this.#outputs).map(([name, output]) => {
            const { schema, required } = describeOutput(output);
            if (required) {
              requiredOutputs.push(name);
            }
            return [name, schema as Schema];
          })
        ),
      },
    };
  }
}

class BoardInstance<
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> {
  readonly inputs: IPORTS;
  readonly outputs: OPORTS;
  // TODO(aomarks) This should get used somewhere.
  readonly #values: ValuesOrOutputPorts<ExtractPortTypes<IPORTS>>;

  constructor(
    inputs: IPORTS,
    outputs: OPORTS,
    values: ValuesOrOutputPorts<ExtractPortTypes<IPORTS>>
  ) {
    this.inputs = inputs;
    this.outputs = outputs;
    this.#values = values;
  }
}

type ExtractPortTypes<PORTS extends BoardInputPorts | BoardOutputPorts> = {
  [PORT_NAME in keyof PORTS]: PORTS[PORT_NAME] extends
    | InputPort<infer TYPE>
    | OutputPortReference<infer TYPE>
    ? TYPE
    : never;
};

export function isBoard(value: unknown): value is GenericBoardDefinition {
  return (
    typeof value === "function" && "isBoard" in value && value.isBoard === true
  );
}

export function describeInput(
  input:
    | Input<JsonSerializable | undefined>
    | InputWithDefault<JsonSerializable | undefined>
    | SerializableInputPort
): {
  schema: JSONSchema4;
  required: boolean;
} {
  const schema = toJSONSchema(input.type);
  let isSpecialOptional = false;
  if (isSpecialInput(input)) {
    if (input.title !== undefined) {
      schema.title = input.title;
    }
    if (input.description !== undefined) {
      schema.description = input.description;
    }
    if (input.default !== undefined) {
      schema.default =
        typeof input.default === "string"
          ? input.default
          : // TODO(aomarks) Why is default JSON stringified? The UI currently
            // requires it, but seems like it should be real JSON.
            JSON.stringify(input.default, null, 2);
    }
    if (input.examples !== undefined && input.examples.length > 0) {
      schema.examples = input.examples.map((example) =>
        typeof example === "string"
          ? example
          : // TODO(aomarks) Why is examples JSON stringified? The UI currently
            // requires it, but seems like it should be real JSON.
            JSON.stringify(example, null, 2)
      );
    }
    if ("optional" in input && input.optional) {
      isSpecialOptional = true;
    }
  }
  const required = schema.default === undefined && !isSpecialOptional;
  return { schema, required };
}

export function describeOutput(
  output:
    | SerializableOutputPortReference
    | Output<JsonSerializable>
    | Input<JsonSerializable>
    | InputWithDefault<JsonSerializable>
): {
  schema: JSONSchema4;
  required: boolean;
} {
  let port;
  if (isSpecialOutput(output)) {
    port = output.port;
  } else {
    port = output;
  }
  const required = !isOptional(port);
  if (isSerializableOutputPortReference(port)) {
    port = port[OutputPortGetter];
  }
  // Input<JsonSerializable> | InputWithDefault<JsonSerializable> | SerializableOutputPort | OutputPort<...>
  const schema = toJSONSchema(port.type);
  if (isSpecialOutput(output)) {
    if (output.title !== undefined) {
      schema.title = output.title;
    }
    if (output.description !== undefined) {
      schema.description = output.description;
    }
  }
  return { schema, required };
}

export function isSerializableOutputPortReference(
  value: unknown
): value is SerializableOutputPortReference {
  return (
    typeof value === "object" && value !== null && OutputPortGetter in value
  );
}
