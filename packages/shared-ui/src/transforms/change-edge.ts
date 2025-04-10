/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, NodeConfiguration } from "@breadboard-ai/types";
import {
  Edge,
  EditOperationContext,
  EditSpec,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  InspectableNode,
  Template,
} from "@google-labs/breadboard";
import { MarkInPortsInvalid } from "./mark-in-ports-invalid";

export { ChangeEdge };

export type ChangeType = "add" | "remove" | "move";

class ChangeEdge implements EditTransform {
  constructor(
    public readonly changeType: ChangeType,
    public readonly graphId: GraphIdentifier,
    public readonly from: Edge,
    public readonly to?: Edge
  ) {}

  async #addAtWireableEdge(
    context: EditOperationContext
  ): Promise<EditTransformResult> {
    const { graphId, from } = this;
    const { to: id } = from;

    const inspectableGraph = context.mutable.graphs.get(graphId);
    if (!inspectableGraph)
      return {
        success: false,
        error: `Unable to inspect graph with id "${graphId}"`,
      };

    const source = inspectableGraph.nodeById(this.from.from);
    if (!source) {
      return { success: false, error: `Unable to find node with id "${id}"` };
    }
    let outPort = from.out;
    if (outPort === undefined) {
      const sourcePorts = await source.ports();
      const sourceMainPort = sourcePorts.outputs.ports.find((port) =>
        port.schema.behavior?.includes("main-port")
      );
      if (sourceMainPort) {
        outPort = sourceMainPort.name;
      }
    }

    const destination = inspectableGraph.nodeById(id);
    if (!destination) {
      return { success: false, error: `Unable to find node with id "${id}"` };
    }

    let inPort = from.in;
    let inPortFound = true;
    if (inPort === undefined) {
      inPortFound = false;
      const destinationPorts = await destination.ports();
      const destinationMainPort = destinationPorts.inputs.ports.find((port) =>
        port.schema.behavior?.includes("main-port")
      );
      if (destinationMainPort) {
        inPort = destinationMainPort.name;
        inPortFound = true;
      }
    }

    const defaultEdit: [spec: EditSpec[], message: string] = [
      [
        {
          type: "addedge",
          edge: { ...from, out: outPort, in: inPort },
          graphId,
        },
      ],
      `Add edge between ${from.from} and ${from.to}`,
    ];

    const description = await destination.describe();
    if (!description.inputSchema.behavior?.includes("at-wireable")) {
      if (!inPortFound) {
        return {
          success: false,
          error: `Unable to add edge: in port was not supplied for ${from.to}`,
        };
      }
      // Do the usual thing, just add the edge.
      return context.apply(...defaultEdit);
    }

    const willBeFirst = destination.incoming().length === 0;
    if (willBeFirst) {
      // Check to see if the the "in" port is "main-port".
      if (inPortFound || isMainPort(destination)) {
        // add the first edge as usual.
        return context.apply(...defaultEdit);
      }
    }

    // By convention, "at-wireable" nodes must have one LLM Content port.
    const contentPort = findFirstContentPort(destination);
    if (!contentPort) {
      return {
        success: false,
        error: `Unable to add edge: node "${destination.title()}" does not have an LLM Content port`,
      };
    }

    const title = source.title();
    const path = source.descriptor.id;
    const text = Template.part({ title, path, type: "in" });

    let portValue = contentPort.value as LLMContent | undefined;
    if (!portValue) {
      portValue = { parts: [], role: "user" };
    } else {
      portValue = structuredClone(portValue);
    }
    const textPart = portValue.parts.find((part) => "text" in part);
    if (!textPart) {
      portValue.parts.push({ text });
    } else {
      textPart.text += ` ${text}`;
    }

    const configuration = {
      [contentPort.name]: portValue,
    } as NodeConfiguration;

    const editingConfig = await context.apply(
      [{ type: "changeconfiguration", id, graphId, configuration }],
      `Adding "@" reference to port "${contentPort.name}" of node "${id}"`
    );
    if (!editingConfig.success) {
      return editingConfig;
    }

    // Create a an "@"-wire
    return context.apply(
      [
        {
          type: "addedge",
          edge: { ...from, out: outPort, in: atPortName(from) },
          graphId,
        },
      ],
      `Add "@" edge between ${from.from} and ${from.to}`
    );

    function isMainPort(node: InspectableNode) {
      const port = node
        .currentPorts()
        .inputs.ports.find((port) => port.name === from.in);
      return port && port.schema.behavior?.includes("main-port");
    }

    function findFirstContentPort(node: InspectableNode) {
      return node
        .currentPorts()
        .inputs.ports.find(
          (port) =>
            port.schema.behavior?.includes("llm-content") &&
            port.schema.behavior?.includes("config")
        );
    }

    function atPortName(edge: Edge) {
      return `p-z-${edge.from}`;
    }
  }

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    let changing: EditTransformResult;
    switch (this.changeType) {
      case "add": {
        return this.#addAtWireableEdge(context);
      }

      case "remove": {
        const { graphId, from } = this;
        changing = await context.apply(
          [{ type: "removeedge", edge: from, graphId }],
          `Remove edge between ${from.from} and ${from.to}`
        );
        if (!changing.success) return changing;
        return new MarkInPortsInvalid(graphId, from.to, from.from).apply(
          context
        );
      }

      case "move": {
        const { graphId, from, to } = this;
        if (!to) {
          return {
            success: false,
            error: "Unable to move edge - no `to` provided",
          };
        }

        changing = await context.apply(
          [
            {
              type: "changeedge",
              from: from,
              to: to,
              graphId,
            },
          ],
          `Change edge from between ${from.from} and ${from.to} to ${to.from} and ${to.to}`
        );
        break;
      }
    }
    return changing;
  }
}
