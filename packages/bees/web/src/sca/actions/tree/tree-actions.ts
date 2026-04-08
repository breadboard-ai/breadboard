/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asAction, ActionMode } from "../../coordination.js";
import { makeAction } from "../binder.js";

export const bind = makeAction();

/**
 * Set the selected agent in the tree.
 *
 * Dispatched from the sidebar tree navigator when the user clicks
 * a tree node.
 */
export const selectAgent = asAction(
  "Select Agent",
  { mode: ActionMode.Immediate },
  async (evt?: Event) => {
    if (!evt) return;
    const { controller } = bind;
    const agentId = (evt as CustomEvent<string | null>).detail;
    controller.agentTree.selectedAgentId = agentId;
  }
);
