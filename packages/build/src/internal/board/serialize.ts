/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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
} from "../common/serializable.js";
import { type JsonSerializable } from "../type-system/type.js";
import {
  OldBoardInstance,
  describeInput,
  describeOutput,
  isBoard,
  isBoardInstance,
  isBoardOutput,
  isSerializableOutputPortReference,
  type BoardInputPorts,
  type BoardOutputPorts,
  type GenericBoardDefinition,
} from "./board.js";
import { ConstantVersionOf, isConstant } from "./constant.js";
import { isConvergence } from "./converge.js";
import {
  isSpecialInput,
  type GenericSpecialInput,
  type Input,
  type InputWithDefault,
} from "./input.js";
import { isLoopback } from "./loopback.js";
import { OptionalVersionOf, isOptional } from "./optional.js";
import { isSpecialOutput } from "./output.js";
import { isStarInputs, type StarInputs } from "./star-inputs.js";
import type { NodeMetadata } from "@google-labs/breadboard-schema/graph.js";

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
    | StarInputs
    | SerializableInputPort,
    { nodeId: string; portName: string }
  >();

  const unconnectedInputs = new Set<
    | Input<JsonSerializable | undefined>
    | InputWithDefault<JsonSerializable | undefined>
    | StarInputs
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
  const magicInputResolutions = new Map<
    GenericSpecialInput,
    { nodeId: string; portName: string }
  >();
  for (const inputs of inputsArray) {
    const sortedBoardInputs = Object.entries(inputs).sort(
      // Sort so that mainInputSchema will also be sorted.
      ([nameA], [nameB]) => nameA.localeCompare(nameB)
    );
    let iterationInputId: string | undefined = undefined;
    const autoId = () => {
      if (iterationInputId === undefined) {
        iterationInputId = nextIdForType("input");
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
      const { schema, required } = describeInput(input);
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
      const normalizedSchema = sortKeys(schema, [
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
      ]);
      if (mainInputName === "*") {
        inputNode.configuration.schema.additionalProperties = normalizedSchema;
      } else {
        inputNode.configuration.schema.properties[mainInputName] =
          normalizedSchema;
        if (required) {
          inputNode.configuration.schema.required.push(mainInputName);
        }
      }
      if (isSpecialInput(input)) {
        magicInputResolutions.set(input, {
          nodeId: inputNodeId,
          portName: mainInputName,
        });
      }
    }
  }

  const outputsArray = Array.isArray(board.outputsForSerialization)
    ? board.outputsForSerialization
    : [board.outputsForSerialization];
  for (const outputs of outputsArray) {
    // Recursively traverse the graph starting from outputs.
    const sortedBoardOutputs = Object.entries(outputs).sort(
      // Sort so that mainOutputSchema will also be sorted.
      ([nameA], [nameB]) => nameA.localeCompare(nameB)
    );
    let iterationOutputId: string | undefined = undefined;
    const autoId = () => {
      if (iterationOutputId === undefined) {
        iterationOutputId = nextIdForType("output");
      }
      return iterationOutputId;
    };
    for (const [name, output] of sortedBoardOutputs) {
      if (name.startsWith("$") && name !== "$error") {
        continue;
      }

      let nested = isBoardOutput(output) ? output : undefined;
      let port;
      let outputNodeId;
      let deprecated = false;
      const portMetadata: { title?: string; description?: string } = {};
      if (isSpecialOutput(output)) {
        port = output.port;
        if (nested === undefined) {
          outputNodeId = output.id;
          if (output.title) {
            portMetadata.title = output.title;
          }
          if (output.description) {
            portMetadata.description = output.description;
          }
        }
        deprecated = output.deprecated ?? false;
      } else {
        port = output;
      }

      nested = nested ?? (isBoardOutput(port) ? port : undefined);

      if (isSerializableOutputPortReference(port)) {
        port = port[OutputPortGetter];
      }
      // TODO(aomarks) Remove cast.
      outputNodeId ??= outputs.$id as string | undefined;
      outputNodeId ??= autoId();

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
        const nodeMetadata = outputs.$metadata as {
          title?: string;
          description?: string;
        };
        if (nodeMetadata !== undefined) {
          outputNode.metadata = nodeMetadata;
        }

        outputNodes.set(outputNodeId, outputNode);
      }
      const { schema, required } = describeOutput(output);
      outputNode.configuration.schema.properties[name] = schema;
      const behaviors = [];
      if (outputs.$bubble) {
        behaviors.push("bubble");
      }
      if (deprecated) {
        behaviors.push("deprecated");
      }
      if (behaviors.length > 0) {
        outputNode.configuration.schema.behavior = behaviors;
      }
      if (required) {
        outputNode.configuration.schema.required.push(name);
      }
      if (nested !== undefined) {
        const { innerBoard, innerPortName } = nested;
        addEdge(
          visitNodeAndReturnItsId(innerBoard),
          innerPortName,
          outputNodeId,
          name,
          isConstant(output),
          !required
        );
      } else if (isSpecialInput(port)) {
        unconnectedInputs.delete(port);
        const resolution = magicInputResolutions.get(port);
        if (resolution !== undefined) {
          addEdge(
            resolution.nodeId,
            resolution.portName,
            outputNodeId,
            name,
            isConstant(output),
            !required
          );
        }
      } else if ("node" in (port as any)) {
        addEdge(
          visitNodeAndReturnItsId((port as any).node),
          (port as any).name,
          outputNodeId,
          name,
          isConstant(output),
          !required
        );
      }
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

  function visitNodeAndReturnItsId(
    node: SerializableNode | OldBoardInstance<BoardInputPorts, BoardOutputPorts>
  ): string {
    let descriptor = nodes.get(node);
    if (descriptor !== undefined) {
      return descriptor.id;
    }
    let type, metadata, thisNodeId;
    let isBoardInstanceBoundToKit = false;
    if (isBoardInstance(node)) {
      const kitBinding = node.__kitBinding;
      if (kitBinding) {
        isBoardInstanceBoundToKit = true;
        type = kitBinding.id;
        metadata = node.values["$metadata"] as NodeMetadata | undefined;
        thisNodeId =
          (node.values["$id"] as string | undefined) ?? nextIdForType(type);
      } else {
        type = "invoke";
        metadata = node.values["$metadata"] as NodeMetadata | undefined;
        thisNodeId =
          (node.values["$id"] as string | undefined) ?? nextIdForType("invoke");
      }
    } else {
      const cast = node as SerializableNode;
      type = cast.type;
      metadata = cast.metadata;
      thisNodeId = cast.id ?? nextIdForType(type);
    }

    const configuration: Record<string, NodeValue> = {};
    descriptor = { id: thisNodeId, type, configuration };

    const { title, description, logLevel } = metadata ?? {};
    if (title || description) {
      descriptor.metadata = {};
      if (title) {
        descriptor.metadata.title = title;
      }
      if (logLevel) {
        descriptor.metadata.logLevel = logLevel;
      }
      if (description) {
        descriptor.metadata.description = description;
      }
    }
    // Note it's important we add the node to the nodes map before we next
    // recurse, or else we can get stuck in a loop.
    nodes.set(node, descriptor);

    const configurationEntries: Array<[string, NodeValue]> = [];
    if (isBoardInstance(node) && !isBoardInstanceBoundToKit) {
      configurationEntries.push([
        "$board",
        `#${embedBoardAndReturnItsId(node.definition)}`,
      ]);
    }
    for (const [portName, inputPort] of Object.entries(
      isBoardInstance(node) ? node.values : node.inputs
    )) {
      if (portName === "$id" || portName === "$metadata") {
        continue;
      }
      unconnectedInputs.delete(inputPort);
      const values = isConvergence(inputPort.value)
        ? inputPort.value.ports
        : inputPort.value
          ? [inputPort.value]
          : [inputPort];
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

        if (isBoardOutput(value)) {
          addEdge(
            visitNodeAndReturnItsId(value.innerBoard),
            value.innerPortName,
            thisNodeId,
            portName,
            wasConstant,
            wasOptional
          );
          continue;
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
        } else if (isStarInputs(value)) {
          unconnectedInputs.delete(value);
          const inputNodeInfo = inputObjectsToInputNodeInfo.get(value);
          if (inputNodeInfo !== undefined) {
            addEdge(
              inputNodeInfo.nodeId,
              "*",
              thisNodeId,
              // TODO(aomarks) Kind of weird. If the input port is also "*",
              // then the runtime seems to just stop. Only "" works. However, if
              // you paste some BGL with "" into the Visual Editor it errors,
              // and the docs say that star ports "can only be wired to other
              // star ports".
              "",
              wasConstant,
              wasOptional
            );
          } else {
            errors.push(
              `${thisNodeId}:${portName} was wired to an input, ` +
                `but that input was not provided to the board inputs.`
            );
          }
        } else if (isSerializableOutputPortReference(value)) {
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
            `Internal error: value was undefined for a ${inputPort.node?.type}:${inputPort.name} port.`
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
        } else if (
          typeof value === "object" &&
          value.constructor !== Object &&
          "value" in value
        ) {
          configurationEntries.push([portName, value.value]);
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
