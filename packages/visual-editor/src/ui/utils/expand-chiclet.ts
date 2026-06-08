/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok, TemplatePart } from "@breadboard-ai/utils";
import { getStepIcon } from "./get-step-icon.js";
import { iconSubstitute } from "./icon-substitute.js";
import { getAssetIcon, getMimeType } from "../../utils/media/mime-type.js";
import type { SCA } from "../../sca/sca.js";

export function expandChiclet(
  part: TemplatePart,
  subGraphId: string | null,
  sca?: SCA
): { tags?: string[]; icon?: string | null; title?: string | null } {
  const { type, path, instance } = part;

  let icon: string | null | undefined;
  let tags: string[] | undefined;
  let title: string | null = null;

  if (!sca) {
    return {};
  }

  const graphController = sca.controller.editor.graph;

  switch (type) {
    case "in": {
      const graphId = subGraphId ? subGraphId : "";
      const metadata = graphController.getMetadataForNode(path, graphId);

      const ports = graphController.getPortsForNode(path, graphId);

      if (ok(metadata) && ok(ports)) {
        icon = getStepIcon(metadata.icon, ports);
        tags = metadata.tags ?? [];
      }

      const nodeTitle = graphController.getTitleForNode(path, graphId);
      if (ok(nodeTitle)) {
        title = nodeTitle ?? null;
      }

      break;
    }

    case "tool": {
      if (instance) {
        const toolIcon = sca?.controller.editor.integrations.registered
          .get(path)
          ?.tools.get(instance)?.icon;
        icon =
          (typeof toolIcon === "string" ? toolIcon : undefined) ||
          "robot_server";
      } else {
        const toolInfo = graphController.tools.get(path);
        const toolIcon = toolInfo?.icon;
        icon = iconSubstitute(
          typeof toolIcon === "string" ? toolIcon : undefined
        );
      }
      break;
    }

    case "asset": {
      icon = "alternate_email";

      const assetInfo = graphController.graphAssets.get(path);
      let mimeType = part.mimeType;
      if (!mimeType && assetInfo) {
        mimeType = getMimeType(assetInfo.data);
      }

      if (mimeType) {
        icon = getAssetIcon(mimeType);
      }

      if (assetInfo?.metadata?.type && !mimeType) {
        icon = iconSubstitute(assetInfo.metadata.type);
      }

      if (assetInfo?.metadata?.subType) {
        const subTypeIcon = iconSubstitute(assetInfo.metadata.subType);
        if (subTypeIcon && !subTypeIcon.includes("/")) {
          icon = subTypeIcon;
        }
      }
      break;
    }
  }

  return {
    tags,
    icon,
    title,
  };
}
