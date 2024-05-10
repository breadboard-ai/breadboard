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
import {
  DefaultValue,
  OutputPortGetter,
  type OutputPortReference,
} from "../common/port.js";
import type {
  SerializableBoard,
  SerializableInputPort,
  SerializableNode,
  SerializableOutputPortReference,
} from "../common/serializable.js";
import { toJSONSchema, type JsonSerializable } from "../type-system/type.js";
import type { GenericSpecialInput } from "./input.js";
import type { Output } from "./output.js";
import { isLoopback, type Loopback } from "./loopback.js";
import { ConstantVersionOf, isConstant } from "./constant.js";
import { isConvergence, type Convergence } from "./converge.js";
import type { Value } from "../../index.js";

/**
 * Serialize a Breadboard board to Breadboard Graph Language (BGL) so that it
 * can be executed.
 */
export function serialize(board: SerializableBoard): GraphDescriptor {
  const nodes = new Map<object, NodeDescriptor>();
  const edges: Edge[] = [];
  const errors: string[] = [];
  const typeCounts = new Map<string, number>();

  // Prepare our main input and output nodes. They represent the overall
  // signature of the board.
  const outputNodes = new Map<string, InputOrOutputNodeDescriptor>();

  // Analyze inputs and remember some things about them that we'll need when we
  // traverse the outputs.
  const inputNodes = new Map<string, InputOrOutputNodeDescriptor>();
  const inputObjectsToInputNodeInfo = new Map<
    GenericSpecialInput | SerializableInputPort,
    { nodeId: string; portName: string }
  >();

  const unconnectedInputs = new Set<
    GenericSpecialInput | SerializableInputPort
  >();
  const sortedBoardInputs = Object.entries(board.inputs).sort(
    // Sort so that mainInputSchema will also be sorted.
    ([nameA], [nameB]) => nameA.localeCompare(nameB)
  );
  for (const [mainInputName, input] of sortedBoardInputs) {
    if (inputObjectsToInputNodeInfo.has(input)) {
      errors.push(
        `The same input was used as both ` +
          `${inputObjectsToInputNodeInfo.get(input)!.portName} and ${mainInputName}.`
      );
    }
    const inputNodeId =
      isSpecialInput(input) && input.id ? input.id : "input-0";
    inputObjectsToInputNodeInfo.set(input, {
      nodeId: inputNodeId,
      portName: mainInputName,
    });
    unconnectedInputs.add(input);
    const schema = toJSONSchema(input.type);
    if (isSpecialInput(input)) {
      if (input.title !== undefined) {
        schema.title = input.title;
      }
      if (input.description !== undefined) {
        schema.description = input.description;
      }
      if (input.default !== undefined) {
        schema.default = input.default;
      }
      if (input.examples !== undefined && input.examples.length > 0) {
        schema.examples = input.examples;
      }
    }
    let inputNode = inputNodes.get(inputNodeId);
    if (inputNode === undefined) {
      inputNode = {
        id: inputNodeId,
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {},
            required: [],
            // TODO(aomarks) Disallow extra properties?
          },
        },
      };
      inputNodes.set(inputNodeId, inputNode);
    }
    inputNode.configuration.schema.properties[mainInputName] = schema;
    inputNode.configuration.schema.required.push(mainInputName);
  }

  // Recursively traverse the graph starting from outputs.
  const sortedBoardOutputs = Object.entries(board.outputs).sort(
    // Sort so that mainOutputSchema will also be sorted.
    ([nameA], [nameB]) => nameA.localeCompare(nameB)
  );
  for (const [name, output] of sortedBoardOutputs) {
    const port = isSpecialOutput(output)
      ? output.port[OutputPortGetter]
      : output[OutputPortGetter];
    const outputNodeId = isSpecialOutput(output)
      ? output.id ?? "output-0"
      : "output-0";
    let outputNode = outputNodes.get(outputNodeId);
    if (outputNode === undefined) {
      outputNode = {
        id: outputNodeId,
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {},
            required: [],
            // TODO(aomarks) Disallow extra properties?
          },
        },
      };
      outputNodes.set(outputNodeId, outputNode);
    }
    const schema = toJSONSchema(port.type);
    if (isSpecialOutput(output)) {
      if (output.title !== undefined) {
        schema.title = output.title;
      }
      if (output.description !== undefined) {
        schema.description = output.description;
      }
    }
    outputNode.configuration.schema.properties[name] = schema;
    outputNode.configuration.schema.required.push(name);
    addEdge(
      visitNodeAndReturnItsId(port.node),
      port.name,
      outputNodeId,
      name,
      isConstant(
        // TODO(aomarks) Should not need this cast.
        output as OutputPortReference<JsonSerializable>
      )
    );
  }

  if (unconnectedInputs.size > 0) {
    for (const input of unconnectedInputs.values()) {
      errors.push(
        `Board input "${inputObjectsToInputNodeInfo.get(input)!.portName}" ` +
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

  return {
    ...(board.title ? { title: board.title } : {}),
    ...(board.description ? { description: board.description } : {}),
    ...(board.version ? { version: board.version } : {}),
    // Sort the nodes and edges for deterministic BGL output.
    edges: edges.sort((a, b) => {
      if (a.from != b.from) {
        return a.from.localeCompare(b.from);
      }
      if (a.to != b.to) {
        return a.to.localeCompare(b.to);
      }
      if (a.out != b.out) {
        return a.out.localeCompare(b.out);
      }
      if (a.in != b.in) {
        return a.in.localeCompare(b.in);
      }
      return 0;
    }),
    nodes: [
      ...[...inputNodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
      ...[...outputNodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
      ...[...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    ],
  };

  function visitNodeAndReturnItsId(node: SerializableNode): string {
    let descriptor = nodes.get(node);
    if (descriptor !== undefined) {
      return descriptor.id;
    }

    const { type, metadata } = node;
    const thisNodeId = node.id ?? nextIdForType(type);
    const configuration: Record<string, NodeValue> = {};
    descriptor = { id: thisNodeId, type, configuration };

    const { title, description } = metadata ?? {};
    if (title || description) {
      descriptor.metadata = {};
      if (title) {
        descriptor.metadata.title = title;
      }
      if (description) {
        descriptor.metadata.description = description;
      }
    }
    // Note it's important we add the node to the nodes map before we next
    // recurse, or else we can get stuck in a loop.
    nodes.set(node, descriptor);

    const configurationEntries: Array<[string, NodeValue]> = [];
    for (const [portName, inputPort] of Object.entries(node.inputs)) {
      unconnectedInputs.delete(inputPort);
      const values = isConvergence(inputPort.value)
        ? inputPort.value.ports
        : [inputPort.value];
      for (let value of values) {
        let wasConstant = false;
        if (isConstant(value)) {
          // TODO(aomarks) The way constant works is kind of hacky.
          value = value[ConstantVersionOf];
          wasConstant = true;
        }

        if (isLoopback(value)) {
          value = value.value;
          if (value === undefined) {
            // TODO(aomarks) Provide more information about which loopback it
            // is.
            throw new Error("Loopback was never resolved");
          }
        }

        if (isSpecialInput(value)) {
          unconnectedInputs.delete(value);
          const inputNodeInfo = inputObjectsToInputNodeInfo.get(value);
          if (inputNodeInfo !== undefined) {
            addEdge(
              inputNodeInfo.nodeId,
              inputNodeInfo.portName,
              thisNodeId,
              portName,
              wasConstant
            );
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
            portName,
            wasConstant
          );
        } else if (value === DefaultValue) {
          // Omit the value.
        } else if (isConvergence(value)) {
          throw new Error(
            `Internal error: value was convergent for a ${inputPort.node.type}:${inputPort.name} port. Nesting convergent is not supported.`
          );
        } else if (value === undefined) {
          // TODO(aomarks) Why is this possible in the type system? An inport port
          // value can never actually be undefined, right?
          throw new Error(
            `Internal error: value was undefined for a ${inputPort.node.type}:${inputPort.name} port.`
          );
        } else if (typeof value === "symbol") {
          // TODO(aomarks) Why is this possible in the type system? This should
          // also not be possible.
          throw new Error(
            `Internal error: value was a symbol (${String(value)}) for a ${inputPort.node.type}:${inputPort.name} port.`
          );
        } else {
          configurationEntries.push([
            portName,
            value satisfies JsonSerializable as NodeValue,
          ]);
        }
      }
    }

    // Sort the configuration object for deterministic BGL output.
    configurationEntries.sort(([aKey], [bKey]) => aKey.localeCompare(bKey));
    for (const [key, val] of Object.values(configurationEntries)) {
      configuration[key] = val;
    }

    return thisNodeId;
  }

  function addEdge(
    from: string,
    fromPort: string,
    to: string,
    toPort: string,
    constant: boolean
  ) {
    const edge: Edge = { from, to, out: fromPort, in: toPort };
    if (constant) {
      edge.constant = true;
    }
    edges.push(edge);
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

function isSpecialOutput(value: unknown): value is Output<JsonSerializable> {
  return (
    typeof value === "object" &&
    value !== null &&
    "__SpecialOutputBrand" in value
  );
}

function isOutputPortReference(
  value: unknown
): value is SerializableOutputPortReference {
  return (
    typeof value === "object" && value !== null && OutputPortGetter in value
  );
}

// Note this is a little stricter than the standard Edge type.
type Edge = {
  from: string;
  out: string;
  to: string;
  in: string;
  constant?: true;
};

type InputOrOutputNodeDescriptor = NodeDescriptor & {
  configuration: {
    schema: JSONSchema4 & {
      properties: Record<string, JSONSchema4>;
      required: string[];
    };
  };
};
