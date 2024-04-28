/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputPort,
  type OutputPortReference,
  type ValuesOrOutputPorts,
} from "../common/port.js";
import type { SerializableBoard } from "../common/serializable.js";
import type { JsonSerializable } from "../type-system/type.js";
import type { GenericSpecialInput } from "./input.js";

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
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
>({
  inputs,
  outputs,
  title,
  description,
  version,
}: BoardParameters<IPORTS, OPORTS>): BoardDefinition<IPORTS, OPORTS> {
  const def = new BoardDefinitionImpl(inputs, outputs);
  return Object.assign(def.instantiate.bind(def), {
    inputs,
    outputs,
    title,
    description,
    version,
  });
}

export interface BoardParameters<
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> {
  inputs: IPORTS;
  outputs: OPORTS;
  title?: string;
  description?: string;
  version?: string;
}

export type BoardInputPorts = Record<
  string,
  InputPort<JsonSerializable> | GenericSpecialInput
>;

export type BoardOutputPorts = Record<
  string,
  OutputPortReference<JsonSerializable>
>;

export type BoardDefinition<
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> = BoardInstantiateFunction<IPORTS, OPORTS> & {
  readonly inputs: IPORTS;
  readonly outputs: OPORTS;
  readonly title?: string;
  readonly description?: string;
  readonly version?: string;
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
}

class BoardInstance<
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> implements SerializableBoard
{
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
