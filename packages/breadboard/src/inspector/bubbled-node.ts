/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EdgeType, describeInput } from "./schemas.js";
import { collectPorts } from "./ports.js";
import { filterBySchema } from "../schema.js";
import {
  InspectableEdge,
  InspectableNode,
  InspectableNodePorts,
  InspectableNodeType,
  InspectablePortList,
} from "./types.js";
import {
  InputValues,
  NodeConfiguration,
  NodeDescriberResult,
  NodeDescriptor,
  OutputValues,
} from "../types.js";
import { NodeMetadata } from "@google-labs/breadboard-schema/graph.js";

/**
 * This is a special kind of an `InspectableNode`, representing a bubbled
 * node instance. Its key difference is that, when it's type = input,
 * it will narrow down the ports and values to only the ones that bubbled up.
 * For instance, the actual input node might have four parameters, but
 * only one of them bubbled up. This node will make sure that it looks as if
 * it only has that one parameter.
 */
export class BubbledInspectableNode implements InspectableNode {
  descriptor: NodeDescriptor;
  #actual: InspectableNode;

  constructor(actual: InspectableNode) {
    const descriptor = actual.descriptor;
    if (descriptor.type !== "input" && descriptor.type !== "output") {
      throw new Error(
        "BubbledInspectableNode can only be an input or an output"
      );
    }
    this.#actual = actual;
    this.descriptor = descriptor;
  }

  title(): string {
    return this.#actual.title();
  }

  description(): string {
    return this.#actual.description();
  }

  incoming(): InspectableEdge[] {
    return this.#actual.incoming();
  }

  outgoing(): InspectableEdge[] {
    return this.#actual.outgoing();
  }

  isEntry(): boolean {
    return this.#actual.isEntry();
  }

  isExit(): boolean {
    return this.#actual.isExit();
  }

  type(): InspectableNodeType {
    return this.#actual.type();
  }

  configuration(): NodeConfiguration {
    return this.#actual.configuration();
  }

  metadata(): NodeMetadata {
    return this.#actual.metadata();
  }

  async describe(
    inputs?: InputValues | undefined
  ): Promise<NodeDescriberResult> {
    if (this.descriptor.type === "input") {
      return describeInput({ inputs });
    }
    return this.#actual.describe(inputs);
  }

  async ports(
    inputValues?: InputValues | undefined,
    outputValues?: OutputValues | undefined
  ): Promise<InspectableNodePorts> {
    if (this.descriptor.type === "input") {
      const described = describeInput({ inputs: inputValues });

      const bubbledValues = filterBySchema(
        outputValues || {},
        described.outputSchema
      );
      const inputs: InspectablePortList = {
        fixed: described.inputSchema.additionalProperties === false,
        ports: collectPorts(
          EdgeType.In,
          this.incoming(),
          described.inputSchema,
          false,
          true,
          inputValues
        ),
      };
      const outputs: InspectablePortList = {
        fixed: described.outputSchema.additionalProperties === false,
        ports: collectPorts(
          EdgeType.Out,
          [],
          described.outputSchema,
          false,
          false,
          bubbledValues
        ),
      };
      return { inputs, outputs };
    }
    return this.#actual.ports(inputValues, outputValues || undefined);
  }
}
