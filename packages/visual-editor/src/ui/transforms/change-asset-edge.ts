/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditOperationContext,
  EditTransform,
  EditTransformResult,
  GraphIdentifier,
  LLMContent,
  NodeValue,
  TextCapabilityPart,
} from "@breadboard-ai/types";
import { Template } from "@breadboard-ai/utils";
import { AssetEdge } from "../types/types.js";
import {
  isLLMContentBehavior,
  isPreviewBehavior,
} from "../../utils/schema/behaviors.js";
import { jsonStringify } from "../../utils/formatting/json-stringify.js";
import { getMimeType } from "../../utils/media/mime-type.js";
import { isTextCapabilityPart } from "../../data/common.js";

export { ChangeAssetEdge as ChangeAssetEdge };

export type ChangeType = "add" | "remove";

const failState = {
  success: false,
  error: `Unable to change asset`,
};

class ChangeAssetEdge implements EditTransform {
  constructor(
    public readonly changeType: ChangeType,
    public readonly graphId: GraphIdentifier,
    public readonly edge: AssetEdge
  ) {}

  async apply(context: EditOperationContext): Promise<EditTransformResult> {
    // Find the target port and its configuration.
    const inspectableGraph = context.mutable.graphs.get(this.graphId);
    if (!inspectableGraph) {
      return failState;
    }

    const inspectableNode = inspectableGraph.nodeById(this.edge.nodeId);
    if (!inspectableNode) {
      return { success: true };
    }

    const targetPort = (await inspectableNode.ports()).inputs.ports.find(
      (port) => {
        return (
          isPreviewBehavior(port.schema) && isLLMContentBehavior(port.schema)
        );
      }
    );
    if (!targetPort) {
      return failState;
    }

    const asset = inspectableGraph.assets().get(this.edge.assetPath);
    if (!asset) {
      return failState;
    }

    const configuration = { ...(inspectableNode?.configuration() ?? {}) };
    let targetPortConfiguration = configuration[targetPort.name] as LLMContent;

    let targetPart: TextCapabilityPart | null = null;
    if (!targetPortConfiguration) {
      const parts = [{ text: "" }];
      const item = { role: "user", parts };

      targetPart = parts[0];
      targetPortConfiguration = item;
      configuration[targetPort.name] = targetPortConfiguration as NodeValue;
    } else {
      const textPart = targetPortConfiguration.parts.find((part) =>
        isTextCapabilityPart(part)
      );
      if (!textPart) {
        return failState;
      }

      targetPart = textPart;
    }

    // Then either add the asset to the text, or remove it.
    switch (this.changeType) {
      case "add": {
        const item = `${Template.preamble({
          title: this.edge.assetPath,
          path: this.edge.assetPath,
          type: "asset",
          mimeType: getMimeType(asset.data),
        })}${jsonStringify(asset.title)}${Template.postamble()}`;

        targetPart.text += ` ${item} `;
        break;
      }

      case "remove": {
        const tmpl = new Template(targetPart.text);
        tmpl.substitute((part) => {
          if (part.path === this.edge.assetPath) {
            return "";
          }

          return `{${JSON.stringify(part)}}`;
        });

        targetPart.text = tmpl.renderable;
        break;
      }
    }

    return context.apply(
      [
        {
          type: "changeconfiguration",
          configuration,
          graphId: this.graphId,
          id: this.edge.nodeId,
        },
      ],
      `Add asset`
    );
  }
}
