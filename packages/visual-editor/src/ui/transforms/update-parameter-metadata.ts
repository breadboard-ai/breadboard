/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, ParameterMetadata } from "@breadboard-ai/types";
import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  isLLMContent,
  isLLMContentArray,
  NodeConfiguration,
  NodeIdentifier,
  Template,
  TemplatePart,
} from "@google-labs/breadboard";

export { UpdateParameterMetadata };

/**
 * Performs an action based on the supplied template part
 */
export type TemplatePartScanner = (part: TemplatePart) => void;

function scanConfiguration(
  config: NodeConfiguration,
  scanner: TemplatePartScanner
): void {
  for (const [, portValue] of Object.entries(config)) {
    let contents: LLMContent[] | null = null;
    if (isLLMContent(portValue)) {
      contents = [portValue];
    } else if (isLLMContentArray(portValue)) {
      contents = portValue;
    }
    if (!contents) continue;
    for (const content of contents) {
      for (const part of content.parts) {
        if ("text" in part) {
          const template = new Template(part.text);
          if (template.hasPlaceholders) {
            template.transform((part) => {
              scanner(part);
              return part;
            });
          }
        }
      }
    }
  }
}

/**
 * This transform scans through the entire graph, finds all currently used
 * parameters and updates the metadata accordingly.
 */
class UpdateParameterMetadata implements EditTransform {
  constructor(public readonly graphId: GraphIdentifier) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    const graphId = this.graphId;
    if (graphId) {
      // For now, don't add subgraph params to the parameter metadata list.
      return { success: true };
    }

    const inspectable = context.mutable.graphs.get(graphId);
    if (!inspectable) {
      return {
        success: false,
        error: `Unable to inspect graph with id "${graphId}"`,
      };
    }

    const newParameterList: { part: TemplatePart; id: NodeIdentifier }[] = [];

    // Always scan the entire graph, since we need to know what to
    // change/add/delete
    for (const node of inspectable.nodes()) {
      const id = node.descriptor.id;
      scanConfiguration(node.configuration(), (part) => {
        if (part.type !== "param") return;
        newParameterList.push({
          part,
          id,
        });
      });
    }

    const metadata = inspectable.metadata() || {};

    // Determine what to delete and what to add.
    const oldParameterList = new Map(Object.entries(metadata.parameters || {}));
    const toCleanup = new Set(oldParameterList.keys());

    const finalParams: Map<string, ParameterMetadata> = new Map();

    for (const { id: nodeId, part } of newParameterList) {
      const id = part.path;
      if (toCleanup.has(id)) toCleanup.delete(id);
      let param = finalParams.get(id);
      if (!param) {
        const old = oldParameterList.get(id);
        if (old) {
          param = { ...old, usedIn: [nodeId] };
        } else {
          param = { title: part.title, usedIn: [nodeId] };
        }
        finalParams.set(id, param);
      } else {
        param.usedIn.push(nodeId);
      }
    }

    for (const id of toCleanup) {
      const old = oldParameterList.get(id);
      if (!old) continue;
      finalParams.set(id, { ...old, usedIn: [] });
    }

    const updating = await context.apply(
      [
        {
          type: "changegraphmetadata",
          graphId,
          metadata: {
            ...metadata,
            parameters: Object.fromEntries(finalParams.entries()),
          },
        },
      ],
      "Updating graph parameter metadata"
    );

    if (!updating.success) return updating;

    return { success: true };
  }
}
