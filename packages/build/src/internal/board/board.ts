/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeDescriberResult, Schema } from "@google-labs/breadboard";
import type {
  GraphMetadata,
  NodeMetadata,
} from "@google-labs/breadboard-schema/graph.js";
import type { JSONSchema4 } from "json-schema";
import { anyOf, unsafeType, type Value } from "../../index.js";
import {
  InputPort,
  isOutputPortReference,
  OutputPort,
  OutputPortGetter,
  type OutputPortReference,
  type ValuesOrOutputPorts,
} from "../common/port.js";
import type {
  SerializableBoard,
  SerializableInputPort,
  SerializableOutputPort,
  SerializableOutputPortReference,
} from "../common/serializable.js";
import {
  toJSONSchema,
  type BreadboardType,
  type JsonSerializable,
} from "../type-system/type.js";
import {
  isSpecialInput,
  type GenericSpecialInput,
  type Input,
  type InputWithDefault,
} from "./input.js";
import { isOptional } from "./optional.js";
import { isSpecialOutput, type Output } from "./output.js";
import type { Loopback } from "./loopback.js";
import type { Convergence } from "./converge.js";
import type {
  AutoOptional,
  Expand,
  FlattenUnion,
  RemoveReadonly,
} from "../common/type-util.js";
import type { StarInputs } from "./star-inputs.js";
import type { KitBinding } from "../kit.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

// TODO(aomarks) Support primary ports in boards.

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
export function board<const T extends BoardInit>({
  inputs,
  outputs,
  id,
  title,
  description,
  version,
  metadata,
  describer,
}: T): BoardDefinition<
  Expand<AutoOptional<RemoveReadonly<SimplifyBoardInitInputs<T["inputs"]>>>>,
  Expand<AutoOptional<RemoveReadonly<SimplifyBoardInitOutputs<T["outputs"]>>>>
> {
  const flatInputs = flattenInputs(inputs as any);
  const flatOutputs = flattenOutputs(outputs as any);
  const newInputs = normalizeBoardInputs(inputs);
  const newOutputs = normalizeBoardOutputs(outputs);
  const defImpl = new BoardDefinitionImpl(
    flatInputs,
    flatOutputs,
    newInputs,
    newOutputs
  );
  const definition = Object.assign(defImpl.instantiate.bind(defImpl), {
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
    describe: defImpl.describe.bind(defImpl),
    describer,
  });
  // TODO(aomarks) This is a bit silly, need a small refactor here so that we
  // aren't juggling all these objects. The complexity here comes from the fact
  // that we want to return a function that also has data attached.
  defImpl.definition = definition;
  return definition;
}

/**
 * Normalize the 3 allowed forms for board `inputs` to just 1.
 */
function normalizeBoardInputs(inputs: BoardInit["inputs"]): InputNode[] {
  if (Array.isArray(inputs)) {
    return inputs;
  }
  if (isInputNode(inputs)) {
    return [inputs];
  }
  return [inputNode(inputs)];
}

/**
 * Normalize the 3 allowed forms for board `outputs` to just 1.
 */
function normalizeBoardOutputs(outputs: BoardInit["outputs"]): OutputNode[] {
  if (Array.isArray(outputs)) {
    return outputs;
  }
  if (isOutputNode(outputs)) {
    return [outputs];
  }
  return [outputNode(outputs)];
}

function isInputNode(value: unknown): value is InputNode {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as InputNode)["isInputNode"] === true
  );
}

function isOutputNode(value: unknown): value is OutputNode {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as OutputNode)["isOutputNode"] === true
  );
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
          : K]-?: I[number][K] extends
          | Input<infer T>
          | InputWithDefault<infer T>
          | undefined
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

export type OldBoardDefinition<
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> = OldBoardInstantiateFunction<IPORTS, OPORTS> & {
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
export type GenericBoardDefinition = OldBoardDefinition<any, any>;

type OldBoardInstantiateFunction<
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> = (
  values: ValuesOrOutputPorts<ExtractPortTypes<IPORTS>>
) => OldBoardInstance<IPORTS, OPORTS>;

class BoardDefinitionImpl<
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> {
  readonly #inputs: IPORTS;
  readonly #outputs: OPORTS;
  readonly #newInputs: InputNode[];
  readonly #newOutputs: OutputNode[];
  definition?: OldBoardDefinition<IPORTS, OPORTS>;

  constructor(
    inputs: IPORTS,
    outputs: OPORTS,
    newInputs: InputNode[],
    newOutputs: OutputNode[]
  ) {
    this.#inputs = inputs;
    this.#outputs = outputs;
    this.#newInputs = newInputs;
    this.#newOutputs = newOutputs;
  }

  instantiate(
    values: ValuesOrOutputPorts<ExtractPortTypes<IPORTS>>,
    kitBinding?: KitBinding
  ): OldBoardInstance<IPORTS, OPORTS> {
    return new OldBoardInstance(
      this.#inputs,
      this.#outputs,
      values,
      this.definition!,
      kitBinding
    );
  }

  async describe(): Promise<NodeDescriberResult> {
    return {
      inputSchema: this.#describeInputs(),
      outputSchema: this.#describeOutputs(),
    };
  }

  #describeInputs(): Schema {
    const groups: Record<string, GenericSpecialInput[]> = {};
    for (const inputNode of this.#newInputs) {
      for (const [name, value] of Object.entries(
        // TODO(aomarks) Should not need this cast.
        inputNode as object as Record<string, GenericSpecialInput>
      )) {
        if (name === "$id" || name === "$metadata") {
          continue;
        }
        let group = groups[name];
        if (group === undefined) {
          group = [];
          groups[name] = group;
        }
        group.push(value);
      }
    }

    const properties: Record<string, Schema> = {};
    const required: string[] = [];
    const numInputs = this.#newInputs.length;
    for (const [name, values] of Object.entries(groups)) {
      const schemasAndRequireds = values.map((value) => describeInput(value));
      const schemas = schemasAndRequireds.map(({ schema }) => schema);
      const requireds = schemasAndRequireds
        .map(({ required }) => required)
        .filter((value) => value);
      if (requireds.length === numInputs) {
        required.push(name);
      }
      const uniqueSchemas = new Set(
        // TODO(aomarks) This is not an ideal way to compare schemas.
        schemas.map((schema) => JSON.stringify(schema))
      );
      if (uniqueSchemas.size === 1) {
        properties[name] = schemas[0] as Schema;
      } else {
        properties[name] = toJSONSchema(
          anyOf(
            ...(values.map((value) => value.type) as [
              BreadboardType,
              BreadboardType,
            ])
          )
        ) as Schema;
      }
    }

    return {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    };
  }

  #describeOutputs(): Schema {
    const groups: Record<string, Array<Value | Output>> = {};
    for (const outputNode of this.#newOutputs) {
      for (const [name, value] of Object.entries(
        // TODO(aomarks) Should not need this cast.
        outputNode as object as Record<string, Value | Output>
      )) {
        if (name === "$id" || name === "$metadata") {
          continue;
        }
        let group = groups[name];
        if (group === undefined) {
          group = [];
          groups[name] = group;
        }
        group.push(value);
      }
    }

    const properties: Record<string, Schema> = {};
    const required: string[] = [];
    const numOutputs = this.#newOutputs.length;
    for (const [name, values] of Object.entries(groups)) {
      const schemasAndRequireds = values.map((value) =>
        describeOutput(
          // TODO(aomarks) Should not need this cast.
          value as any
        )
      );
      const schemas = schemasAndRequireds.map(({ schema }) => schema);
      const requireds = schemasAndRequireds
        .map(({ required }) => required)
        .filter((value) => value);
      if (requireds.length === numOutputs) {
        required.push(name);
      }
      const uniqueSchemas = new Set(
        // TODO(aomarks) This is not an ideal way to compare schemas.
        schemas.map((schema) => JSON.stringify(schema))
      );
      if (uniqueSchemas.size === 1) {
        properties[name] = schemas[0] as Schema;
      } else {
        properties[name] = toJSONSchema(
          anyOf(
            ...(schemas.map((schema) => unsafeType(schema)) as object[] as [
              BreadboardType,
              BreadboardType,
            ])
          )
        ) as Schema;
      }
    }

    return {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    };
  }
}

export class OldBoardInstance<
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> {
  readonly inputs: IPORTS;
  readonly outputs: OPORTS;
  readonly values: ValuesOrOutputPorts<ExtractPortTypes<IPORTS>>;
  readonly definition: OldBoardDefinition<IPORTS, OPORTS>;
  readonly __kitBinding?: KitBinding;

  constructor(
    inputs: IPORTS,
    outputs: OPORTS,
    values: ValuesOrOutputPorts<ExtractPortTypes<IPORTS>>,
    definition: OldBoardDefinition<IPORTS, OPORTS>,
    kitBinding?: KitBinding
  ) {
    this.inputs = inputs;
    this.outputs = this.#tagOutputs(outputs);
    this.values = values;
    this.definition = definition;
    this.__kitBinding = kitBinding;
  }

  /**
   * Tag all of our outputs with a link back this board instance. This allows us
   * to recognize when we are hitting a board boundary during serialization,
   * which is important because we need to do special stuff there (e.g. create
   * an invoke node).
   */
  #tagOutputs(outputs: OPORTS): OPORTS {
    return Object.fromEntries(
      Object.entries(outputs).map(([name, output]) => [
        name,
        {
          ...output,
          innerPortName: name,
          innerBoard: this as object as OldBoardInstance<
            BoardInputPorts,
            BoardOutputPorts
          >,
        } satisfies BoardOutput,
      ])
    ) as object as OPORTS;
  }
}

export function isBoardInstance(
  value: unknown
): value is OldBoardInstance<BoardInputPorts, BoardOutputPorts> {
  // TODO(aomarks) Use a better brand
  return (
    (value as Partial<OldBoardInstance<BoardInputPorts, BoardOutputPorts>>)
      .definition !== undefined
  );
}

export type BoardOutput = (
  | OutputPortReference<JsonSerializable>
  | Output<JsonSerializable>
  | Input<JsonSerializable>
  | InputWithDefault<JsonSerializable>
) & {
  innerBoard: OldBoardInstance<BoardInputPorts, BoardOutputPorts>;
  innerPortName: string;
};

export function isBoardOutput(value: unknown): value is BoardOutput {
  return (value as Partial<BoardOutput>).innerBoard !== undefined;
}

type ExtractPortTypes<PORTS extends BoardInputPorts | BoardOutputPorts> = {
  [PORT_NAME in keyof PORTS]: PORTS[PORT_NAME] extends
    | InputPort<infer TYPE>
    | Value<infer TYPE>
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
    | Output<JsonSerializable | undefined>
    | Input<JsonSerializable | undefined>
    | InputWithDefault<JsonSerializable | undefined>
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
  const schema = toJSONSchema(unroll(port as any).type);
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

export function unroll(
  value:
    | Input<JsonSerializable>
    | InputWithDefault<JsonSerializable>
    | Output<JsonSerializable>
    | OutputPort<JsonSerializable>
    | OutputPortReference<JsonSerializable>
    | SerializableOutputPort
):
  | Input<JsonSerializable>
  | InputWithDefault<JsonSerializable>
  | OutputPort<JsonSerializable>
  | SerializableOutputPort {
  if (isSpecialOutput(value)) {
    return unroll(value.port as any);
  }
  if ("type" in value) {
    return value;
  }
  if (isOutputPortReference(value)) {
    return unroll(value[OutputPortGetter]);
  }
  return value;
}

// ------------------
// NEW ZONE
// ------------------

export interface BoardInit {
  inputs: InputNode | InputNode[] | AnonymousInputNodeShorthand;
  outputs: OutputNode | OutputNode[] | AnonymousOutputNodeShorthand;
  id?: string;
  title?: string;
  description?: string;
  version?: string;
  metadata?: GraphMetadata;
  describer?: GenericBoardDefinition;
}

type AnonymousInputNodeShorthand = Record<
  string,
  GenericSpecialInput | StarInputs
>;

type AnonymousOutputNodeShorthand = Record<string, Value | Output | undefined>;

export type BoardDefinition<
  I extends Record<string, JsonSerializable | undefined> = any,
  O extends Record<string, JsonSerializable | undefined> = any,
> = BoardInstantiateFunction<I, O> &
  SerializableBoard & { describe: () => Promise<NodeDescriberResult> };

export type BoardInstantiateFunction<
  I extends Record<string, JsonSerializable | undefined>,
  O extends Record<string, JsonSerializable | undefined>,
> = (
  inputs: {
    [K in keyof I]: Value<I[K]>;
  } & { $id?: string; $metadata?: NodeMetadata }
) => BoardInstance<I, O>;

export interface BoardInstance<
  I extends Record<string, JsonSerializable | undefined>,
  O extends Record<string, JsonSerializable | undefined>,
> {
  outputs: Expand<WrapInValues<FilterSerializable<FlattenUnion<O>>>>;
}

type FilterSerializable<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K] extends JsonSerializable | undefined ? T[K] : never;
};

type WrapInValues<T extends Record<string, JsonSerializable | undefined>> = {
  [K in keyof T]: Value<T[K]>;
};

/**
 * Board inputs can either be an object (one input node) or an array of objects
 * (multiple input nodes). This function returns a union of types in the array
 * case.
 */
type SimplifyBoardInitInputs<T extends BoardInit["inputs"]> =
  T extends InputNode<infer X>
    ? X
    : T extends InputNode[]
      ? // TODO(amoarks) Recursion shouldn't be needed.
        SimplifyBoardInitInputs<T[number]>
      : T extends AnonymousInputNodeShorthand
        ? ExtractInputTypes<T>
        : never;

/**
 *
 */
export type SimplifyBoardInitOutputs<T extends BoardInit["outputs"]> =
  T extends OutputNode<infer X>
    ? X
    : // : T extends Array<OutputNode<infer X>>
      //   ? X
      T extends Array<OutputNode>
      ? SimplifyBoardInitOutputs<T[number]>
      : T extends AnonymousOutputNodeShorthand
        ? ExtractOutputTypes<T>
        : never;

/**
 * Pulls out the type parameter for each `Input`, taking care to add `undefined`
 * in the case of `InputWithDefault`. This is because when there is a default,
 * then it is optional from the caller's perspective.
 */
type ExtractInputTypes<
  T extends Record<string, GenericSpecialInput | StarInputs>,
> = {
  [K in keyof T]: T[K] extends Input<infer X>
    ? X
    : T[K] extends InputWithDefault<infer X>
      ? X | undefined
      : T[K] extends StarInputs<infer X>
        ? X
        : never;
};

/**
 * Pulls out the type parameter for each `Input`, taking care to add `undefined`
 * in the case of `InputWithDefault`. This is because when there is a default,
 * then it is optional from the caller's perspective.
 */
type ExtractOutputTypes<T extends Record<string, Value | Output | undefined>> =
  {
    // prettier-ignore
    [K in keyof T]:
      T[K] extends Input<infer X> ? X :
      T[K] extends InputWithDefault<infer X> ? X | undefined :
      T[K] extends Output<infer X> ? X :
      T[K] extends OutputPort<infer X> ? X :
      T[K] extends OutputPortReference<infer X> ? X :
      T[K] extends Loopback<infer X> ? X :
      T[K] extends Convergence<infer X> ? X :
      T[K] extends Value<infer X> ? X :
      never
    // prettier-ignore-end
  };

export function inputNode<
  T extends Record<string, GenericSpecialInput | StarInputs>,
>(
  inputs: T,
  metadata?: NodeMetadata & { id?: string }
): InputNode<Expand<ExtractInputTypes<T>>> {
  const result: Record<string, unknown> = { ...inputs };
  if (metadata) {
    if (metadata.id) {
      result.$id = metadata.id;
      metadata = { ...metadata };
      delete metadata["id"];
    }
    result.$metadata = metadata;
  }
  return result as unknown as InputNode<ExtractInputTypes<T>>;
}

export interface InputNode<
  T extends Record<string, JsonSerializable | undefined> = Record<
    string,
    JsonSerializable | undefined
  >,
> {
  // TODO(aomarks) Better branding
  isInputNode: true;
}

export function outputNode<
  T extends Record<string, Value | Output | undefined>,
>(
  outputs: T,
  metadata?: NodeMetadata & { id?: string } & { bubble?: boolean }
): OutputNode<Expand<ExtractOutputTypes<T>>> {
  const result: Record<string, unknown> = { ...outputs };
  if (metadata) {
    if (metadata.id) {
      result.$id = metadata.id;
      metadata = { ...metadata };
      delete metadata["id"];
    }
    if (metadata.bubble) {
      result.$bubble = metadata.bubble;
      metadata = { ...metadata };
      delete metadata["bubble"];
    }
    result.$metadata = metadata;
  }
  return result as unknown as OutputNode<ExtractOutputTypes<T>>;
}

export interface OutputNode<
  T extends Record<string, JsonSerializable | undefined> = Record<
    string,
    JsonSerializable | undefined
  >,
> {
  // TODO(aomarks) Better branding
  isOutputNode: true;
}
