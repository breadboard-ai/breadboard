/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputPorts, OutputPorts } from "./instance.js";
import {
  InputPort,
  OutputPort,
  type PortConfig,
  type PortConfigMap,
  type ValuesOrOutputPorts,
} from "./port.js";

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
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
>(inputs: IPORTS, outputs: OPORTS): BoardDefinition<IPORTS, OPORTS> {
  const def = new BoardDefinitionImpl(inputs, outputs);
  return Object.assign(def.instantiate.bind(def), {
    inputs,
    outputs,
  });
}

export type BoardDefinition<
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> = BoardInstantiateFunction<IPORTS, OPORTS> & {
  readonly inputs: IPORTS;
  readonly outputs: OPORTS;
};

type BoardInstantiateFunction<
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> = <VALUES extends Record<string, unknown>>(
  values: BoardInputValues<IPORTS, VALUES>
) => BoardInstance<IPORTS, OPORTS>;

type BoardInputValues<
  IPORTS extends BoardInputPorts,
  VALUES extends Record<string, unknown>,
> = ValuesOrOutputPorts<ExtractPortConfigs<IPORTS>> & {
  [PORT_NAME in keyof VALUES]: PORT_NAME extends keyof IPORTS
    ? ValuesOrOutputPorts<ExtractPortConfigs<IPORTS>>[PORT_NAME]
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
  IPORTS extends BoardInputPorts,
  OPORTS extends BoardOutputPorts,
> {
  readonly inputs: InputPorts<ExtractPortConfigs<IPORTS>>;
  readonly outputs: OutputPorts<ExtractPortConfigs<OPORTS>>;
  readonly #values: ValuesOrOutputPorts<ExtractPortConfigs<IPORTS>>;

  constructor(
    inputs: IPORTS,
    outputs: OPORTS,
    values: ValuesOrOutputPorts<ExtractPortConfigs<IPORTS>>
  ) {
    // TODO(aomarks) Shouldn't need these casts.
    this.inputs = inputs as InputPorts<PortConfigMap> as InputPorts<
      ExtractPortConfigs<IPORTS>
    >;
    this.outputs = outputs as OutputPorts<PortConfigMap> as OutputPorts<
      ExtractPortConfigs<OPORTS>
    >;
    this.#values = values;
  }
}

type ExtractPortConfigs<PORTS extends BoardInputPorts | BoardOutputPorts> = {
  [PORT_NAME in keyof PORTS]: PORTS[PORT_NAME] extends
    | InputPort<infer PORT_CONFIG>
    | OutputPort<infer PORT_CONFIG>
    ? { type: PORT_CONFIG["type"] }
    : never;
};

export type BoardInputPorts = Record<string, InputPort<PortConfig>>;
export type BoardOutputPorts = Record<string, OutputPort<PortConfig>>;
