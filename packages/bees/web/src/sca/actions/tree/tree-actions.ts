/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asAction, ActionMode } from "../../coordination.js";
import { makeAction } from "../binder.js";
import { loadBundleAsync } from "../../utils/load-bundle.js";

export const bind = makeAction();

/**
 * Set the selected agent in the tree.
 *
 * Dispatched from the sidebar tree navigator or subagent panel
 * when the user clicks an agent node.
 *
 * When the selected agent has a bundle, sync `stage.currentView`
 * and trigger the bundle load so the iframe renders.
 */
export const selectAgent = asAction(
  "Select Agent",
  { mode: ActionMode.Immediate },
  async (evt?: Event) => {
    if (!evt) return;
    const { controller, services } = bind;
    const agentId = (evt as CustomEvent<string | null>).detail;
    controller.agentTree.selectedAgentId = agentId;

    if (!agentId) return;

    // If the selected agent has a bundle, ensure the iframe gets it.
    const ticket = controller.global.tickets.find((t) => t.id === agentId);
    if (ticket?.tags?.includes("bundle")) {
      controller.stage.currentView = agentId;
      // Small delay to let Lit render the iframe element.
      await new Promise((r) => setTimeout(r, 100));
      await loadBundleAsync(agentId, services);
    }
  }
);
