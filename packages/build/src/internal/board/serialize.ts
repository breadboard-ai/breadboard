/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO(aomarks) Switch import to schema package
import type {
  GraphDescriptor,
  NodeDescriptor,
  NodeValue,
} from "@google-labs/breadboard";
import type { JSONSchema4 } from "json-schema";
import { DefaultValue, OutputPortGetter } from "../common/port.js";
import type {
  SerializableBoard,
  SerializableInputPort,
  SerializableNode,
  SerializableOutputPortReference,
} from "../common/serializable.js";
import { toJSONSchema, type JsonSerializable } from "../type-system/type.js";
import type { GenericSpecialInput } from "./input.js";
import { isPlaceholder } from "./placeholder.js";

/**
 * Serialize a Breadboard board to Breadboard Graph Language (BGL) so that it
 * can be executed.
 */
export function serialize(board: SerializableBoard): GraphDescriptor {
  const nodes = new Map<object, NodeDescriptor>();
  const edges: Array<{ from: string; out: string; to: string; in: string }> =
    [];
  const errors: string[] = [];
  const typeCounts = new Map<string, number>();

  // Prepare our main input and output nodes. They represent the overall
  // signature of the board.
  const mainInputNodeId = nextIdForType("input");
  const mainOutputNodeId = nextIdForType("output");
  const mainInputSchema: Record<string, JSONSchema4> = {};
  const mainOutputSchema: Record<string, JSONSchema4> = {};

  // Analyze inputs and remember some things about them that we'll need when we
  // traverse the outputs.
  const inputNames = new Map<
    GenericSpecialInput | SerializableInputPort,
    string
  >();
  const unconnectedInputs = new Set<
    GenericSpecialInput | SerializableInputPort
  >();
  const sortedBoardInputs = Object.entries(board.inputs).sort(
    // Sort so that mainInputSchema will also be sorted.
    ([nameA], [nameB]) => nameA.localeCompare(nameB)
  );
  for (const [mainInputName, input] of sortedBoardInputs) {
    if (inputNames.has(input)) {
      errors.push(
        `The same input was used as both ` +
          `${inputNames.get(input)!} and ${mainInputName}.`
      );
    }
    inputNames.set(input, mainInputName);
    unconnectedInputs.add(input);
    const schema = toJSONSchema(input.type);
    if (isSpecialInput(input)) {
      if (input.default !== undefined) {
        schema.default = input.default;
      }
      if (input.description !== undefined) {
        schema.description = input.description;
      }
      if (input.examples !== undefined && input.examples.length > 0) {
        schema.examples = input.examples;
      }
    }
    mainInputSchema[mainInputName] = schema;
  }

  // Recursively traverse the graph starting from outputs.
  const sortedBoardOutputs = Object.entries(board.outputs).sort(
    // Sort so that mainOutputSchema will also be sorted.
    ([nameA], [nameB]) => nameA.localeCompare(nameB)
  );
  for (const [mainOutputName, output] of sortedBoardOutputs) {
    const actualOutput = output[OutputPortGetter];
    mainOutputSchema[mainOutputName] = toJSONSchema(actualOutput.type);
    addEdge(
      visitNodeAndReturnItsId(actualOutput.node),
      actualOutput.name,
      mainOutputNodeId,
      mainOutputName
    );
  }

  if (unconnectedInputs.size > 0) {
    for (const input of unconnectedInputs.values()) {
      errors.push(
        `Board input "${inputNames.get(input)}" ` +
          `is not reachable from any of its outputs.`
      );
    }
  }

  if (errors.length > 0) {
    // TODO(aomarks) Refactor this to a Result<> return, because these errors are
    // expected as part of the normal course of operation.
    throw new Error(
      `Error serializing board:\n\n${errors.sort().join("\n\n")}`
    );
  }

  const mainInputNode: NodeDescriptor = {
    id: mainInputNodeId,
    type: "input",
    configuration: {
      schema: {
        type: "object",
        properties: mainInputSchema,
        required: Object.keys(mainInputSchema),
        // TODO(aomarks) Disallow extra properties
      },
    },
  };
  const mainOutputNode: NodeDescriptor = {
    id: mainOutputNodeId,
    type: "output",
    configuration: {
      schema: {
        type: "object",
        properties: mainOutputSchema,
        required: Object.keys(mainOutputSchema),
      },
    },
  };

  // Sort the nodes and edges for deterministic BGL output.
  const sortedNodes = [...nodes.values()].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  return {
    ...(board.title ? { title: board.title } : {}),
    ...(board.description ? { description: board.description } : {}),
    ...(board.version ? { version: board.version } : {}),
    nodes: [mainInputNode, mainOutputNode, ...sortedNodes],
    edges: edges.sort((a, b) => {
      if (a.from != b.from) {
        return a.from.localeCompare(b.from);
      }
      if (a.out != b.out) {
        return a.out.localeCompare(b.out);
      }
      if (a.to != b.to) {
        return a.to.localeCompare(b.to);
      }
      if (a.in != b.in) {
        return a.in.localeCompare(b.in);
      }
      return 0;
    }),
  };

  function visitNodeAndReturnItsId(node: SerializableNode): string {
    const descriptor = nodes.get(node);
    if (descriptor !== undefined) {
      return descriptor.id;
    }

    const { type } = node;
    const thisNodeId = nextIdForType(type);
    const configuration: Record<string, NodeValue> = {};

    // Note it's important we add the node to the nodes map before we next
    // recurse, or else we can get stuck in a loop.
    nodes.set(node, { id: thisNodeId, type, configuration });

    const configurationEntries: Array<[string, NodeValue]> = [];
    for (const [portName, inputPort] of Object.entries(node.inputs)) {
      unconnectedInputs.delete(inputPort);
      let value = inputPort.value;

      if (isPlaceholder(value)) {
        value = value.value;
        if (value === undefined) {
          throw new Error("Placeholder was never resolved");
        }
      }

      if (isSpecialInput(value)) {
        unconnectedInputs.delete(value);
        const mainInputPortName = inputNames.get(value);
        if (mainInputPortName !== undefined) {
          addEdge(mainInputNodeId, mainInputPortName, thisNodeId, portName);
        } else {
          // TODO(aomarks) Does it actually make sense in some cases to wire up
          // an input, but not make it part of the board's interface? In that
          // case it would seem to mean that it's *only* possible for that value
          // to be provided externally (e.g. by asking the user at runtime), not
          // through a value wired into the board.
          errors.push(
            `${thisNodeId}:${portName} was wired to an input, ` +
              `but that input was not provided to the board inputs.`
          );
        }
      } else if (isOutputPortReference(value)) {
        const wiredOutputPort = value[OutputPortGetter];
        addEdge(
          visitNodeAndReturnItsId(wiredOutputPort.node),
          wiredOutputPort.name,
          thisNodeId,
          portName
        );
      } else if (value === undefined) {
        // TODO(aomarks) Why is this possible in the type system? An inport port
        // value can never actually be undefined, right?
        throw new Error(
          `Internal error: value was undefined for a ${inputPort.node.type}:${inputPort.name} port.`
        );
      } else if (value === DefaultValue) {
        // Omit the value.
      } else {
        configurationEntries.push([
          portName,
          value satisfies JsonSerializable as NodeValue,
        ]);
      }
    }

    // Sort the configuration object for deterministic BGL output.
    configurationEntries.sort(([aKey], [bKey]) => aKey.localeCompare(bKey));
    for (const [key, val] of Object.values(configurationEntries)) {
      configuration[key] = val;
    }

    return thisNodeId;
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

function isSpecialInput(value: unknown): value is GenericSpecialInput {
  return (
    typeof value === "object" &&
    value !== null &&
    "__SpecialInputBrand" in value
  );
}

function isOutputPortReference(
  value: unknown
): value is SerializableOutputPortReference {
  return (
    typeof value === "object" && value !== null && OutputPortGetter in value
  );
}
