/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok, TemplatePart } from "@breadboard-ai/utils";
import { Project } from "../state/index.js";
import { getStepIcon } from "./get-step-icon.js";
import { iconSubstitute } from "./icon-substitute.js";
import type { SCA } from "../../sca/sca.js";

export function expandChiclet(
  part: TemplatePart,
  projectState: Project | null,
  subGraphId: string | null,
  sca?: SCA
): { tags?: string[]; icon?: string | null; title?: string | null } {
  const { type, path, instance } = part;

  let icon: string | null | undefined;
  let tags: string[] | undefined;
  let title: string | null = null;

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

      const nodeTitle = projectState.getTitleForNode(
        path,
        subGraphId ? subGraphId : ""
      );
      if (ok(nodeTitle)) {
        title = nodeTitle ?? null;
      }

      break;
    }

    case "tool": {
      if (instance) {
        icon =
          projectState.integrations.registered.get(path)?.tools.get(instance)
            ?.icon || "robot_server";
      } else {
        const toolInfo = sca?.controller.editor.graph.tools.get(path);
        icon = iconSubstitute(toolInfo?.icon);
      }
      break;
    }

    case "asset": {
      icon = "alternate_email";

      const assetInfo =
        projectState?.stepEditor.fastAccess.graphAssets.get(path);
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
    title,
  };
}
