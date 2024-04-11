/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-types */

import {
  InputPort,
  OutputPort,
  OutputPortGetter,
  type OutputPortReference,
} from "../common/port.js";
import type { SerializableNode } from "../common/serializable.js";
import type { Expand } from "../common/type-util.js";
import type { BreadboardType, JsonSerializable } from "../type-system/type.js";
import type {
  DynamicInputPortConfig,
  DynamicOutputPortConfig,
  StaticInputPortConfig,
  StaticOutputPortConfig,
} from "./config.js";

export class Instance<
  /* Inputs         */ I extends { [K: string]: JsonSerializable },
  /* Outputs        */ O extends { [K: string]: JsonSerializable },
  /* Dynamic Output */ DO extends JsonSerializable | undefined,
  /* Primary Input  */ PI extends keyof I | undefined,
  /* Primary Output */ PO extends keyof O | undefined,
> implements SerializableNode
{
  readonly type: string;
  readonly inputs: { [K in keyof I]: InputPort<I[K]> };
  readonly outputs: Expand<
    { [K in keyof O]: OutputPort<O[K]> } & (DO extends JsonSerializable
      ? { [K: string]: OutputPort<DO> | undefined }
      : {})
  >;
  readonly primaryInput: PI extends keyof I ? InputPort<I[PI]> : undefined;
  readonly primaryOutput: PO extends keyof O ? OutputPort<O[PO]> : undefined;
  // TODO(aomarks) Clean up output port getter
  readonly [OutputPortGetter]: PO extends keyof O
    ? OutputPort<O[PO]>
    : undefined;
  readonly #dynamicInputType?: BreadboardType;
  readonly #dynamicOutputType?: BreadboardType;
  readonly #reflective: boolean;

  constructor(
    type: string,
    staticInputs: { [K: string]: StaticInputPortConfig },
    dynamicInputs: DynamicInputPortConfig | undefined,
    staticOutputs: { [K: string]: StaticOutputPortConfig },
    dynamicOutputs: DynamicOutputPortConfig | undefined,
    reflective: boolean,
    args: {
      [K: string]: JsonSerializable | OutputPortReference<JsonSerializable>;
    }
  ) {
    this.type = type;
    this.#dynamicInputType = dynamicInputs?.type;
    this.#dynamicOutputType = dynamicOutputs?.type;
    this.#reflective = reflective;

    {
      const { ports, primary } = this.#processInputs(staticInputs, args);
      this.inputs = ports as (typeof this)["inputs"];
      this.primaryInput = primary as (typeof this)["primaryInput"];
    }

    {
      const { ports, primary } = this.#processOutputs(
        staticInputs,
        staticOutputs,
        args
      );
      this.outputs = ports as (typeof this)["outputs"];
      this.primaryOutput = primary as (typeof this)["primaryOutput"];
      this[OutputPortGetter] = primary as (typeof this)["primaryOutput"];
    }
  }

  #processInputs(
    inputs: { [K: string]: StaticInputPortConfig },
    args: {
      [K: string]: JsonSerializable | OutputPortReference<JsonSerializable>;
    }
  ) {
    const ports: { [K: string]: InputPort<JsonSerializable> } = {};
    let primary: InputPort<JsonSerializable> | undefined = undefined;

    // Static inputs
    for (const [name, config] of Object.entries(inputs)) {
      const arg = args[name];
      if (arg === undefined) {
        throw new Error(`Argument ${name} is required`);
      }
      const port = new InputPort(config.type, name, this, arg);
      ports[name] = port;
      if (primary) {
        if (this.primaryInput !== undefined) {
          throw new Error("More than one primary input");
        }
        primary = port;
      }
    }

    // Dynamic inputs
    for (const [name, arg] of Object.entries(args)) {
      if (inputs[name] !== undefined) {
        // Static input, already handled.
        continue;
      }
      if (this.#dynamicInputType === undefined) {
        throw new Error(`Unexpected input: ${name}`);
      }
      const port = new InputPort(this.#dynamicInputType, name, this, arg);
      ports[name] = port;
    }

    return { ports, primary };
  }

  #processOutputs(
    inputs: { [K: string]: StaticInputPortConfig },
    outputs: { [K: string]: StaticOutputPortConfig },
    args: {
      [K: string]: JsonSerializable | OutputPortReference<JsonSerializable>;
    }
  ) {
    const ports: { [K: string]: OutputPort<JsonSerializable> } = {};
    let primary: OutputPort<JsonSerializable> | undefined = undefined;

    for (const [name, config] of Object.entries(outputs)) {
      const port = new OutputPort(config.type, name, this);
      ports[name] = port;
      if (config.primary) {
        if (primary !== undefined) {
          throw new Error("More than one primary output");
        }
        primary = port;
      }
    }

    if (this.#reflective && this.#dynamicOutputType !== undefined) {
      for (const name of Object.keys(args)) {
        if (inputs[name] !== undefined) {
          // Static input, doesn't reflect.
          continue;
        }
        const port = new OutputPort(this.#dynamicOutputType, name, this);
        ports[name] = port;
      }
    }

    return { ports, primary };
  }
}
