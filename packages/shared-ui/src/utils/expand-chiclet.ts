/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok, TemplatePart } from "@google-labs/breadboard";
import { Project } from "../state";

export function expandChiclet(
  part: TemplatePart,
  projectState: Project | null,
  subGraphId: string | null
): { tags?: string[]; icon?: string } {
  const { type, path } = part;

  let icon: string | undefined;
  let tags: string[] | undefined;

  if (!projectState) {
    return {};
  }

  switch (type) {
    case "in": {
      const outcome = projectState.getMetadataForNode(
        path,
        subGraphId ? subGraphId : ""
      );

      if (ok(outcome)) {
        icon = outcome.icon ?? "";
        switch (icon) {
          case "ask-user": {
            icon = "chat_mirror";
            break;
          }

          case "generative": {
            icon = "spark";
            break;
          }
        }

        tags = outcome.tags ?? [];
      }
      break;
    }

    case "tool": {
      const toolInfo = projectState?.fastAccess.tools.get(path);
      icon = toolInfo?.icon;
      break;
    }

    case "asset": {
      const assetInfo = projectState?.fastAccess.graphAssets.get(path);
      icon = assetInfo?.metadata?.type;

      if (assetInfo?.metadata?.subType) {
        switch (assetInfo?.metadata?.subType) {
          case "drawable": {
            icon = "draw";
            break;
          }
        }
      }
    }
  }

  return {
    tags,
    icon,
  };
}
