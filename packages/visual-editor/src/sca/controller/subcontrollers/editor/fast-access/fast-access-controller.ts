/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../../decorators/field.js";
import { RootController } from "../../root-controller.js";
import type {
  FastAccessMode,
  FastAccessItem,
  DisplayItem,
} from "../../../../types.js";
import type { Tool } from "../../../../../ui/state/types.js";
import type { IntegrationsController } from "../integrations/integrations-controller.js";
import { NOTEBOOKLM_TOOL_PATH } from "@breadboard-ai/utils";

export { FastAccessController };

/**
 * Controller for Fast Access menu state and display item derivation.
 *
 * Owns the menu's display context (`fastAccessMode`), text filter,
 * and computes the filtered list of display items from raw items
 * supplied by GraphController.
 *
 * All filtering logic lives here so it can be tested without a DOM.
 */
class FastAccessController extends RootController {
  /**
   * The current display context for the Fast Access menu.
   * Set by the component that shows the menu (entity-editor or text-editor).
   * `null` means the menu is not active.
   */
  @field()
  accessor fastAccessMode: FastAccessMode | null = null;

  /**
   * Text filter for searching items.
   * Set by the menu's search input.
   */
  @field()
  accessor filter: string | null = null;

  /**
   * Compute the filtered list of display items given raw items and external
   * configuration that isn't yet in SCA.
   *
   * @param rawItems - unfiltered items from GraphController.getFastAccessItems
   * @param agentModeTools - agent-mode tools from GraphController
   * @param opts.environmentName - from GlobalConfig context (legacy)
   * @param opts.enableNotebookLm - from FlagController
   * @param opts.integrationsController - IntegrationsController for integration tools
   */
  getDisplayItems(
    rawItems: FastAccessItem[],
    agentModeTools: ReadonlyMap<string, Tool>,
    opts: {
      environmentName?: string;
      enableNotebookLm: boolean;
      integrationsController: IntegrationsController | null;
    }
  ): DisplayItem[] {
    const mode = this.fastAccessMode;
    if (!mode) return [];

    const showAssets = mode === "browse";
    const showTools = mode !== "route";
    const showComponents = mode !== "route";
    const showRoutes = mode === "route";
    const showAgentModeTools = mode !== "route";

    const filterRe = this.filter ? new RegExp(this.filter, "gim") : null;
    const items: DisplayItem[] = [];

    for (const item of rawItems) {
      // Apply visibility filters
      if (item.kind === "asset" && !showAssets) continue;
      if (item.kind === "tool" && !showTools) continue;
      if (item.kind === "component" && !showComponents) continue;
      if (item.kind === "route" && !showRoutes) continue;

      // Apply text filter
      if (filterRe) {
        filterRe.lastIndex = 0;

        if (item.kind === "asset") {
          // Exclude splash asset when filtering
          if (item.asset.path === "@@splash") continue;
          if (!filterRe.test(item.asset.metadata?.title ?? item.asset.path)) {
            continue;
          }
        } else if (item.kind === "tool") {
          filterRe.lastIndex = 0;
          if (!filterRe.test(item.tool.title ?? "")) continue;
        } else if (item.kind === "component") {
          filterRe.lastIndex = 0;
          if (!filterRe.test(item.component.title)) continue;
        } else if (item.kind === "route") {
          filterRe.lastIndex = 0;
          if (!filterRe.test(item.route.title)) continue;
        }
      }

      // Apply environment tag filter for tools
      if (item.kind === "tool" && opts.environmentName) {
        const { tags } = item.tool;
        if (tags) {
          let excluded = false;
          for (const tag of tags) {
            if (
              tag.startsWith("environment") &&
              tag !== `environment-${opts.environmentName}`
            ) {
              excluded = true;
              break;
            }
          }
          if (excluded) continue;
        }
      }

      items.push(item);
    }

    // Append agent mode tools (routing, memory, notebookLM)
    if (showAgentModeTools) {
      for (const [id, tool] of agentModeTools) {
        // Skip NotebookLM tool if flag is not enabled
        if (id === NOTEBOOKLM_TOOL_PATH && !opts.enableNotebookLm) {
          continue;
        }
        // Apply filter if present
        if (filterRe) {
          filterRe.lastIndex = 0;
          if (!filterRe.test(tool.title ?? "")) continue;
        }
        items.push({ kind: "tool", tool: { ...tool, url: id } });
      }
    }

    // Append integration tools from IntegrationsController
    if (opts.integrationsController) {
      for (const [url, state] of opts.integrationsController.registered) {
        if (state.status !== "complete") continue;
        for (const [, tool] of state.tools) {
          if (filterRe) {
            filterRe.lastIndex = 0;
            if (tool.title && !filterRe.test(tool.title)) continue;
          }
          items.push({ kind: "integration-tool", url, tool });
        }
      }
    }

    return items;
  }
}
