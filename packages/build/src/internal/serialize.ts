/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO(aomarks) Switch import to schema package
import type {
  GraphDescriptor,
  NodeDescriptor,
  Edge,
  NodeValue,
} from "@google-labs/breadboard";
import type {
  BoardDefinition,
  BoardInputPorts,
  BoardOutputPorts,
} from "./board.js";
import type { GenericBreadboardNodeInstance } from "./node.js";
import { isOutputPortReference, OutputPortGetter } from "./port.js";

/**
 * Serialize a Breadboard board to Breadboard Graph Language (BGL) so that it
 * can be executed.
 */
export function serialize(
  board: BoardDefinition<BoardInputPorts, BoardOutputPorts>
): GraphDescriptor {
  const nodes = new Map<object, NodeDescriptor>();
  const edges: Edge[] = [];
  const typeCounts = new Map<string, number>();

  // TODO(aomarks) We might actually want each input/output to be its own
  // input/output node, but then we should add the ability to create input
  // "sets" or something, for when you actually *do* need to gate until all
  // inputs/outputs are fulfilled.
  const input = addNode({ type: "input", inputs: {}, outputs: {} });
  for (const [name, port] of Object.entries(board.inputs)) {
    addEdge(input, name, addNode(port.node), port.name);
  }

  const output = addNode({ type: "output", inputs: {}, outputs: {} });
  for (const [name, port] of Object.entries(board.outputs)) {
    addEdge(addNode(port.node), port.name, output, name);
  }

  return {
    nodes: [...nodes.values()],
    edges,
  };

  function addNode(node: GenericBreadboardNodeInstance): string {
    const descriptor = nodes.get(node);
    if (descriptor !== undefined) {
      return descriptor.id;
    }

    const { type } = node;
    const id = nextIdForType(type);
    const configuration: Record<string, NodeValue> = {};
    nodes.set(node, { id, type, configuration });

    for (const [name, input] of Object.entries(node.inputs)) {
      if (isOutputPortReference(input.value)) {
        const port = input.value[OutputPortGetter];
        addEdge(addNode(port.node), port.name, id, name);
      } else {
        configuration[name] = input.value as NodeValue;
      }
    }

    return id;
  }

  function addEdge(from: string, fromPort: string, to: string, toPort: string) {
    edges.push({ from, out: fromPort, to, in: toPort });
  }

  function nextIdForType(type: string): string {
    const count = typeCounts.get(type) ?? 0;
    typeCounts.set(type, count + 1);
    return `${type}-${count}`;
  }
}
