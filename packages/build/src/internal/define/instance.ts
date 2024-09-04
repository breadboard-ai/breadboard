/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-types */

import { breadboardErrorType, type BreadboardError } from "../common/error.js";
import {
  DefaultValue,
  InputPort,
  OutputPort,
  OutputPortGetter,
  type OutputPortReference,
} from "../common/port.js";
import type { SerializableNode } from "../common/serializable.js";
import type { KitBinding } from "../kit.js";
import type { BreadboardType, JsonSerializable } from "../type-system/type.js";
import type {
  DynamicInputPortConfig,
  DynamicOutputPortConfig,
  StaticInputPortConfig,
  StaticOutputPortConfig,
} from "./config.js";

export class Instance<
  /* Inputs         */ I extends { [K: string]: JsonSerializable },
  /* Outputs        */ O extends { [K: string]: JsonSerializable | undefined },
  /* Dynamic Output */ DO extends JsonSerializable | undefined,
  /* Primary Input  */ PI extends string | false,
  /* Primary Output */ PO extends string | false,
  /* Reflective     */ R extends boolean,
> implements SerializableNode
{
  readonly id?: string;
  readonly type: string;
  readonly inputs: { [K in keyof I]: InputPort<I[K]> };
  readonly outputs: {
    [K in keyof O | "$error"]: K extends "$error"
      ? OutputPort<BreadboardError>
      : OutputPort<O[K]>;
  };
  readonly primaryInput: PI extends keyof I ? InputPort<I[PI]> : undefined;
  readonly primaryOutput: PO extends keyof O ? OutputPort<O[PO]> : undefined;
  // TODO(aomarks) Clean up output port getter
  readonly [OutputPortGetter]: PO extends keyof O
    ? OutputPort<O[PO]>
    : undefined;
  readonly #dynamicInputType?: BreadboardType;
  readonly #dynamicOutputType?: BreadboardType;
  readonly #reflective: boolean;
  readonly metadata?: { title: string; description: string };

  constructor(
    type: string,
    staticInputs: { [K: string]: StaticInputPortConfig },
    dynamicInputs: DynamicInputPortConfig | undefined,
    staticOutputs: { [K: string]: StaticOutputPortConfig },
    dynamicOutputs: DynamicOutputPortConfig | undefined,
    reflective: boolean,
    args: {
      [K: string]: JsonSerializable | OutputPortReference<JsonSerializable>;
    } & { $id?: string },
    kitBinding?: KitBinding
  ) {
    this.type = kitBinding?.id ?? type;
    this.#dynamicInputType = dynamicInputs?.type;
    this.#dynamicOutputType = dynamicOutputs?.type;
    this.#reflective = reflective;

    this.id = args["$id"];
    if (this.id !== undefined) {
      args = { ...args };
      delete args["$id"];
    }

    {
      const { ports, primary, metadata } = this.#processInputs(
        staticInputs,
        args
      );
      this.inputs = ports as (typeof this)["inputs"];
      this.primaryInput = primary as (typeof this)["primaryInput"];
      this.metadata = metadata as (typeof this)["metadata"];
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

  #assertedOutputs = new Map<string, OutputPort<JsonSerializable>>();

  unsafeOutput: DO extends JsonSerializable
    ? R extends false
      ? <N extends string>(
          name: N extends keyof O ? never : N
        ) => OutputPort<DO>
      : never
    : never = ((name) => {
    if (this.#dynamicOutputType === undefined) {
      throw new Error(
        `unsafeOutput was called unnecessarily on a BreadboardNode. ` +
          `Type "${this.type}" has entirely static outputs. ` +
          `Use "<node>.outputs.${name}" instead.`
      );
    }
    if (this.#reflective) {
      throw new Error(
        `unsafeOutput was called unnecessarily on a BreadboardNode. ` +
          `Type "${this.type}" is reflective. ` +
          `Use "<node>.outputs.${name}" instead.`
      );
    }
    if (this.outputs[name] !== undefined) {
      throw new Error(
        `unsafeOutput was called unnecessarily on a BreadboardNode. ` +
          `Type "${this.type}" already has a static port called "${name}". ` +
          `Use "<node>.outputs.${name}" instead.`
      );
    }
    let port = this.#assertedOutputs.get(name);
    if (port !== undefined) {
      return port;
    }
    port = new OutputPort(this.#dynamicOutputType, name, this);
    this.#assertedOutputs.set(name, port);
    return port;
  }) as (typeof this)["unsafeOutput"];

  #processInputs(
    staticInputs: { [K: string]: StaticInputPortConfig },
    args: {
      [K: string]: JsonSerializable | OutputPortReference<JsonSerializable>;
    }
  ) {
    const ports: { [K: string]: InputPort<JsonSerializable> } = {};
    let primary: InputPort<JsonSerializable> | undefined = undefined;

    const metadata = args["$metadata"];
    if (metadata !== undefined) {
      args = { ...args };
      delete args["$metadata"];
    }

    // Static inputs
    for (const [name, config] of Object.entries(staticInputs)) {
      const arg = args[name];
      if (
        arg === undefined &&
        config.optional !== true &&
        config.default === undefined
      ) {
        throw new Error(`Argument ${name} is required`);
      }
      const port = new InputPort(config.type, name, this, arg ?? DefaultValue);
      ports[name] = port;
      if (config.primary) {
        if (this.primaryInput !== undefined) {
          throw new Error("More than one primary input");
        }
        primary = port;
      }
    }

    // Dynamic inputs
    for (const [name, arg] of Object.entries(args)) {
      if (staticInputs[name] !== undefined) {
        // Static input, already handled.
        continue;
      }
      if (this.#dynamicInputType === undefined) {
        throw new Error(`Unexpected input: ${name}`);
      }
      const port = new InputPort(this.#dynamicInputType, name, this, arg);
      ports[name] = port;
    }

    return { ports, primary, metadata };
  }

  #processOutputs(
    staticInputs: { [K: string]: StaticInputPortConfig },
    staticOutputs: { [K: string]: StaticOutputPortConfig },
    args: {
      [K: string]: JsonSerializable | OutputPortReference<JsonSerializable>;
    }
  ) {
    const ports: { [K: string]: OutputPort<JsonSerializable | undefined> } & {
      assert?: (name: string) => OutputPort<JsonSerializable | undefined>;
    } = {
      $error: new OutputPort(breadboardErrorType, "$error", this),
    };
    let primary: OutputPort<JsonSerializable | undefined> | undefined =
      undefined;

    for (const [name, config] of Object.entries(staticOutputs)) {
      const port = new OutputPort(config.type, name, this);
      ports[name] = port;
      if (config.primary) {
        if (primary !== undefined) {
          throw new Error("More than one primary output");
        }
        primary = port;
      }
    }

    if (this.#dynamicOutputType !== undefined) {
      const type = this.#dynamicOutputType;
      if (this.#reflective) {
        // For reflective nodes, we know immediately at instantiation time what
        // all the output ports are, because it's determined entirely by the
        // inputs, which are exhaustively initialized at instantiation.
        for (const name of Object.keys(args)) {
          if (staticInputs[name] !== undefined) {
            // Static input, doesn't reflect.
            continue;
          }
          const port = new OutputPort(type, name, this);
          ports[name] = port;
        }
      } else {
        // For other (non-reflective) nodes that have dynamic outputs, we can't
        // know at initialization time what ports exist, since that's up to the
        // describe function.
        //
        // However, we do need some way to let the user create references to
        // these ports. One approach would be to make ports a Proxy object, and
        // create the OutputPort any time there is a property access. But, we
        // want to make it clear to see when a port is being asserted, since the
        // type system has absolutely no idea if this is a valid port or not.
        ports.assert = (
          name: string
        ): OutputPort<JsonSerializable | undefined> => {
          let port = ports[name];
          if (port !== undefined) {
            return port;
          }
          port = new OutputPort(type, name, this);
          ports[name] = port;
          return port;
        };
      }
    }
    return { ports, primary };
  }
}
