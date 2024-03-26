/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputPort,
  OutputPort,
  type ValuesOrOutputPorts,
} from "../common/port.js";
import type { JsonSerializable } from "../type-system/type.js";

// TODO(aomarks) Support primary ports in boards.
// TODO(aomarks) Support adding descriptions to board ports.

/**
 * Define a new Breadboard board.
 *
 * Example usage:
 *
 * ```ts
 * export const recipeMaker = board(
 *   // Inputs
 *   {recipeName},
 *   // Outputs
 *   {recipe: llmRecipeResult}
 * );
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
  INPUT_PORTS extends BoardInputPorts,
  OUTPUT_PORTS extends BoardOutputPorts,
>(
  inputs: INPUT_PORTS,
  outputs: OUTPUT_PORTS
): BoardDefinition<INPUT_PORTS, OUTPUT_PORTS> {
  const def = new BoardDefinitionImpl(inputs, outputs);
  return Object.assign(def.instantiate.bind(def), {
    inputs,
    outputs,
  });
}

export type BoardDefinition<
  INPUT_PORTS extends BoardInputPorts,
  OUTPUT_PORTS extends BoardOutputPorts,
> = BoardInstantiateFunction<INPUT_PORTS, OUTPUT_PORTS> & {
  readonly inputs: INPUT_PORTS;
  readonly outputs: OUTPUT_PORTS;
};

type BoardInstantiateFunction<
  INPUT_PORTS extends BoardInputPorts,
  OUTPUT_PORTS extends BoardOutputPorts,
> = <VALUES extends Record<string, unknown>>(
  values: BoardInputValues<INPUT_PORTS, VALUES>
) => BoardInstance<INPUT_PORTS, OUTPUT_PORTS>;

type BoardInputValues<
  INPUT_PORTS extends BoardInputPorts,
  INPUT_VALUES extends Record<string, unknown>,
> = ValuesOrOutputPorts<ExtractPortTypes<INPUT_PORTS>> & {
  [NAME in keyof INPUT_VALUES]: NAME extends keyof INPUT_PORTS
    ? ValuesOrOutputPorts<ExtractPortTypes<INPUT_PORTS>>[NAME]
    : never;
};

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

  instantiate<VALUES extends Record<string, unknown>>(
    values: BoardInputValues<IPORTS, VALUES>
  ): BoardInstance<IPORTS, OPORTS> {
    return new BoardInstance(this.#inputs, this.#outputs, values);
  }
}

class BoardInstance<
  INPUT_PORTS extends BoardInputPorts,
  OUTPUT_PORTS extends BoardOutputPorts,
> {
  readonly inputs: INPUT_PORTS;
  readonly outputs: OUTPUT_PORTS;
  // TODO(aomarks) This should get used somewhere.
  readonly #values: ValuesOrOutputPorts<ExtractPortTypes<INPUT_PORTS>>;

  constructor(
    inputs: INPUT_PORTS,
    outputs: OUTPUT_PORTS,
    values: ValuesOrOutputPorts<ExtractPortTypes<INPUT_PORTS>>
  ) {
    this.inputs = inputs;
    this.outputs = outputs;
    this.#values = values;
  }
}

type ExtractPortTypes<PORTS extends BoardInputPorts | BoardOutputPorts> = {
  [PORT_NAME in keyof PORTS]: PORTS[PORT_NAME] extends
    | InputPort<infer TYPE>
    | OutputPort<infer TYPE>
    ? TYPE
    : never;
};

export type BoardInputPorts = Record<string, InputPort<JsonSerializable>>;
export type BoardOutputPorts = Record<string, OutputPort<JsonSerializable>>;
