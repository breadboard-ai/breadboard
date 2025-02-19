/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart, LLMContent, NodeValue } from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  isLLMContent,
  isLLMContentArray,
  NodeIdentifier,
  PortIdentifier,
} from "@google-labs/breadboard";
import { Template } from "../utils/template";
import { AutoWireInPorts } from "./autowire-in-ports";

export { UpdateNodeTitle };

class UpdateNodeTitle implements EditTransform {
  constructor(
    public readonly graphId: GraphIdentifier,
    public readonly nodeId: NodeIdentifier,
    public readonly title: string
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const graphId = this.graphId;
    const inspectable = context.mutable.graphs.get(graphId);
    if (!inspectable)
      return {
        success: false,
        error: `Unable to inspect graph with id "${graphId}"`,
      };

    for (const node of inspectable.nodes()) {
      const id = node.descriptor.id;
      if (id === this.nodeId) continue;
      const updates: [PortIdentifier, NodeValue][] = [];
      const config = node.configuration();
      for (const [portName, portValue] of Object.entries(config)) {
        let contents: LLMContent[] | null = null;
        let array = false;
        if (isLLMContent(portValue)) {
          contents = [portValue];
        } else if (isLLMContentArray(portValue)) {
          contents = portValue;
          array = true;
        }
        if (!contents) continue;
        let didTransform = false;
        const updated: LLMContent[] = [];
        for (const content of contents) {
          const parts: DataPart[] = [];
          for (const part of content.parts) {
            if ("text" in part) {
              const template = new Template(part.text);
              if (template.hasPlaceholders) {
                const text = template.transform((part) => {
                  const { type, path } = part;
                  if (type === "in" && path === this.nodeId) {
                    didTransform = true;
                    return { type, path, title: this.title };
                  }
                  return part;
                });
                parts.push({ text });
                continue;
              }
            }
            parts.push(part);
          }
          updated.push({ parts, role: content.role });
        }
        if (didTransform) {
          updates.push([
            portName,
            (array ? updated : updated.at(0)) as NodeValue,
          ]);
        }
      }
      if (updates.length === 0) continue;
      const newConfig = structuredClone(config);
      for (const [portName, updated] of updates) {
        newConfig[portName] = updated;
      }
      const changingConfig = await context.apply(
        [
          {
            type: "changeconfiguration",
            id,
            configuration: newConfig,
            reset: true,
            graphId,
          },
        ],
        "Updating Node Titles in @-references."
      );
      if (!changingConfig.success) return changingConfig;

      const autowiring = await new AutoWireInPorts(id, graphId, [
        { path: this.nodeId, title: this.title },
      ]).apply(context);
      if (!autowiring.success) return autowiring;
    }

    return { success: true };
  }
}
