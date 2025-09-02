/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok, TemplatePart } from "@google-labs/breadboard";
import { Project } from "../state";
import { iconSubstitute } from "./icon-substitute";
import { getStepIcon } from "./get-step-icon";

export function expandChiclet(
  part: TemplatePart,
  projectState: Project | null,
  subGraphId: string | null
): { tags?: string[]; icon?: string | null } {
  const { type, path } = part;

  let icon: string | null | undefined;
  let tags: string[] | undefined;

  if (!projectState) {
    return {};
  }

  switch (type) {
    case "in": {
      const metadata = projectState.getMetadataForNode(
        path,
        subGraphId ? subGraphId : ""
      );

      const ports = projectState.getPortsForNode(
        path,
        subGraphId ? subGraphId : ""
      );

      if (ok(metadata) && ok(ports)) {
        icon = getStepIcon(metadata.icon, ports);
        tags = metadata.tags ?? [];
      }
      break;
    }

    case "tool": {
      const toolInfo = projectState?.fastAccess.tools.get(path);
      icon = iconSubstitute(toolInfo?.icon);
      break;
    }

    case "asset": {
      icon = "alternate_email";

      const assetInfo = projectState?.fastAccess.graphAssets.get(path);
      if (assetInfo?.metadata?.type) {
        icon = iconSubstitute(assetInfo.metadata.type);
      }

      if (assetInfo?.metadata?.subType) {
        icon = iconSubstitute(assetInfo.metadata.subType);
      }
    }
  }

  return {
    tags,
    icon,
  };
}
