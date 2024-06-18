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
import { ConstantVersionOf, isConstant } from "./constant.js";
import { isConvergence } from "./converge.js";
import type { GenericSpecialInput, Input, InputWithDefault } from "./input.js";
import { isLoopback } from "./loopback.js";
import { OptionalVersionOf, isOptional } from "./optional.js";
import type { Output } from "./output.js";
import { isBoard, type GenericBoardDefinition } from "./board.js";

/**
 * Serialize a Breadboard board to Breadboard Graph Language (BGL) so that it
 * can be executed.
 */
export function serialize(board: SerializableBoard): GraphDescriptor {
  const nodes = new Map<object, NodeDescriptor>();
  const edges: Edge[] = [];
  const graphs = new Map<string, GraphDescriptor>();
  const errors: string[] = [];
  const typeCounts = new Map<string, number>();
  let nextEmbeddedGraphId = 0;

  // Prepare our main input and output nodes. They represent the overall
  // signature of the board.
  const outputNodes = new Map<string, InputOrOutputNodeDescriptor>();

  // Analyze inputs and remember some things about them that we'll need when we
  // traverse the outputs.
  const inputNodes = new Map<string, InputOrOutputNodeDescriptor>();
  const inputObjectsToInputNodeInfo = new Map<
    | Input<JsonSerializable | undefined>
    | InputWithDefault<JsonSerializable | undefined>
    | SerializableInputPort,
    { nodeId: string; portName: string }
  >();

  const unconnectedInputs = new Set<
    | Input<JsonSerializable | undefined>
    | InputWithDefault<JsonSerializable | undefined>
    | SerializableInputPort
  >();

  const inputsArray = (
    Array.isArray(board.inputsForSerialization)
      ? board.inputsForSerialization
      : [board.inputsForSerialization]
  ) as Array<
    Record<
      string,
      | SerializableInputPort
      | Input<JsonSerializable | undefined>
      | InputWithDefault<JsonSerializable | undefined>
    >
  >;
  let i = 0;
  for (const inputs of inputsArray) {
    const sortedBoardInputs = Object.entries(inputs).sort(
      // Sort so that mainInputSchema will also be sorted.
      ([nameA], [nameB]) => nameA.localeCompare(nameB)
    );
    let iterationInputId: string | undefined = undefined;
    const autoId = () => {
      if (iterationInputId == undefined) {
        iterationInputId;
        iterationInputId = `input-${i}`;
        i++;
      }
      return iterationInputId;
    };
    for (const [mainInputName, input] of sortedBoardInputs) {
      if (mainInputName === "$id" || mainInputName === "$metadata") {
        continue;
      }
      // if (inputObjectsToInputNodeInfo.has(input)) {
      //   errors.push(
      //     `The same input was used as both ` +
      //       `${inputObjectsToInputNodeInfo.get(input)!.portName} and ${mainInputName}.`
      //   );
      // }
      const inputNodeId =
        (inputs.$id as string | undefined) ??
        (isSpecialInput(input) ? input.id : undefined) ??
        autoId();

      inputObjectsToInputNodeInfo.set(input, {
        nodeId: inputNodeId,
        portName: mainInputName,
      });
      unconnectedInputs.add(input);
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
        const metadata = inputs.$metadata as {
          title?: string;
          description?: string;
        };
        if (metadata !== undefined) {
          inputNode.metadata = metadata;
        }
        inputNodes.set(inputNodeId, inputNode);
      }
      inputNode.configuration.schema.properties[mainInputName] = sortKeys(
        schema,
        [
          "type",
          "behavior",
          "title",
          "description",
          "default",
          "examples",
          "anyOf",
          "properties",
          "items",
          "required",
          "additionalProperties",
        ]
      );
      if (schema.default === undefined && !isSpecialOptional) {
        inputNode.configuration.schema.required.push(mainInputName);
      }
    }
  }

  const outputsArray = Array.isArray(board.outputsForSerialization)
    ? board.outputsForSerialization
    : [board.outputsForSerialization];
  let j = 0;
  for (const outputs of outputsArray) {
    // Recursively traverse the graph starting from outputs.
    const sortedBoardOutputs = Object.entries(outputs).sort(
      // Sort so that mainOutputSchema will also be sorted.
      ([nameA], [nameB]) => nameA.localeCompare(nameB)
    );
    let iterationOutputId: string | undefined = undefined;
    const autoId = () => {
      if (iterationOutputId == undefined) {
        iterationOutputId;
        iterationOutputId = `output-${j}`;
        j++;
      }
      return iterationOutputId;
    };
    for (const [name, output] of sortedBoardOutputs) {
      if (name === "$id" || name === "$metadata") {
        continue;
      }
      const port = isSpecialOutput(output)
        ? output.port[OutputPortGetter]
        : output[OutputPortGetter];
      const outputNodeId =
        (outputs.$id as string | undefined) ??
        (isSpecialOutput(output) ? output.id : undefined) ??
        autoId();
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
        const metadata = outputs.$metadata as {
          title?: string;
          description?: string;
        };
        if (metadata !== undefined) {
          outputNode.metadata = metadata;
        }
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
      const isOpt = isSpecialOutput(output)
        ? isOptional(output.port)
        : isOptional(output);
      if (!isOpt) {
        outputNode.configuration.schema.required.push(name);
      }
      addEdge(
        visitNodeAndReturnItsId(port.node),
        port.name,
        outputNodeId,
        name,
        isConstant(output),
        isOpt
      );
    }
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

  const bgl: GraphDescriptor = {
    ...(board.title ? { title: board.title } : {}),
    ...(board.description ? { description: board.description } : {}),
    ...(board.version ? { version: board.version } : {}),
    ...(board.metadata ? { metadata: board.metadata } : {}),
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
  if (graphs.size > 0) {
    bgl.graphs = Object.fromEntries([...graphs]);
  }
  return bgl;

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

        let wasOptional = false;
        if (isOptional(value)) {
          // TODO(aomarks) The way optional works is kind of hacky.
          value = value[OptionalVersionOf];
          wasOptional = true;
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
              wasConstant,
              wasOptional
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
            wasConstant,
            wasOptional
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
        } else if (isBoard(value)) {
          configurationEntries.push([
            portName,
            {
              kind: "board",
              path: `#${embedBoardAndReturnItsId(value)}`,
            },
          ]);
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
    constant: boolean,
    optional: boolean
  ) {
    const edge: Edge = { from, to, out: fromPort, in: toPort };
    if (constant) {
      edge.constant = true;
    }
    if (optional) {
      edge.optional = true;
    }
    edges.push(edge);
  }

  function nextIdForType(type: string): string {
    const count = typeCounts.get(type) ?? 0;
    typeCounts.set(type, count + 1);
    return `${type}-${count}`;
  }

  function embedBoardAndReturnItsId(board: GenericBoardDefinition): string {
    const id = `subgraph-${nextEmbeddedGraphId}`;
    nextEmbeddedGraphId++;
    graphs.set(id, serialize(board));
    return id;
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
  optional?: true;
};

type InputOrOutputNodeDescriptor = NodeDescriptor & {
  configuration: {
    schema: JSONSchema4 & {
      properties: Record<string, JSONSchema4>;
      required: string[];
    };
  };
};

function sortKeys<T extends Record<string, unknown>>(
  obj: T,
  fieldOrder: string[]
): T {
  return Object.fromEntries(
    Object.entries(obj).sort(([nameA], [nameB]) => {
      const indexA = fieldOrder.indexOf(nameA);
      const indexB = fieldOrder.indexOf(nameB);
      if (indexA !== indexB) {
        return (
          (indexA === -1 ? Number.MAX_VALUE : indexA) -
          (indexB === -1 ? Number.MAX_VALUE : indexB)
        );
      }
      return nameA.localeCompare(nameB);
    })
  ) as T;
}
