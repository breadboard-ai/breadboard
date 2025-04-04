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
  InspectableAsset,
  isTextCapabilityPart,
} from "@google-labs/breadboard";
import { AssetEdge } from "../types/types";
import { isLLMContentBehavior, isPreviewBehavior } from "../utils/behaviors";
import { LLMContent, TextCapabilityPart } from "@breadboard-ai/types";
import { getMimeType } from "../utils/mime-type";

export { ChangeAssetEdge as ChangeAssetEdge };

export type ChangeType = "add" | "remove";

const failState = {
  success: false,
  error: `Unable to add asset`,
};

function createAssetString(edge: AssetEdge, asset: InspectableAsset) {
  return `{{"type": "asset", "path": "${
    edge.assetPath
  }", "mimeType": "${getMimeType(asset.data)}", "title": "${asset.title}"}}`;
}

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
      return failState;
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
        targetPart.text += ` ${createAssetString(this.edge, asset)} `;
        break;
      }

      case "remove": {
        targetPart.text = targetPart.text.replace(
          new RegExp(createAssetString(this.edge, asset), "gim"),
          ""
        );
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
