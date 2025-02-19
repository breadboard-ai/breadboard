/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart, LLMContent } from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  isLLMContent,
  isLLMContentArray,
  NodeIdentifier,
  NodeValue,
  PortIdentifier,
} from "@google-labs/breadboard";
import { Template, TemplatePart } from "../utils/template";

export { TransformAllNodes };

/**
 * Returns either a new replacement part or null if the part does not need to
 * be replaced.
 */
export type TemplatePartTransformer = (
  part: TemplatePart
) => TemplatePart | null;

export type EditTransformFactory = (id: NodeIdentifier) => EditTransform;

class TransformAllNodes implements EditTransform {
  constructor(
    public readonly graphId: GraphIdentifier,
    public readonly templateTransformer: TemplatePartTransformer,
    public readonly logMessage: string,
    public readonly nodeTransformer?: EditTransformFactory,
    /**
     * If present, skips this node, since it is the node that is triggering
     * all the edits. If absent, there is no node that triggers the transform.
     */
    public readonly currentNode?: NodeIdentifier
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
      if (id === this.currentNode) continue;
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
                  const transformed = this.templateTransformer(part);
                  if (transformed === null) {
                    return part;
                  } else {
                    didTransform = true;
                    return transformed;
                  }
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
        this.logMessage
      );
      if (!changingConfig.success) return changingConfig;

      if (this.nodeTransformer) {
        const transformingNode = await this.nodeTransformer(id).apply(context);
        if (!transformingNode.success) return transformingNode;
      }
    }
    return { success: true };
  }
}
