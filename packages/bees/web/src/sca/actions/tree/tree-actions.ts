/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asAction, ActionMode } from "../../coordination.js";
import { makeAction } from "../binder.js";
import { loadBundleAsync } from "../../utils/load-bundle.js";
import { updateAgentHash } from "../../utils/agent-hash.js";

export const bind = makeAction();

/**
 * Set the selected agent in the tree.
 *
 * Dispatched from the sidebar tree navigator or subagent panel
 * when the user clicks an agent node.
 *
 * Drives both the stage (bundle loading) and the chat (thread
 * selection) — the agent tree is the single source of truth.
 */
export const selectAgent = asAction(
  "Select Agent",
  { mode: ActionMode.Immediate },
  async (evt?: Event) => {
    if (!evt) return;
    const { controller, services } = bind;
    const agentId = (evt as CustomEvent<string | null>).detail;
    controller.agentTree.selectedAgentId = agentId;

    // Sync URL hash for deep linking.
    // Include active view tab if available.
    if (typeof window !== "undefined") {
      updateAgentHash(agentId);
    }

    // Sync chat to the selected agent.
    if (agentId) {
      const ticket = controller.global.tickets.find((t) => t.id === agentId);

      // If the agent has a chat thread, activate it.
      if (ticket?.tags?.includes("chat")) {
        controller.chat.activeThreadId = agentId;
        controller.chat.visitedThreadIds.add(agentId);
        controller.chat.pendingChoices = [];
        controller.chat.selectedChoiceIds = [];

        // Notify the host about the chat switch.
        if (
          ticket.status === "suspended" &&
          ticket.assignee === "user"
        ) {
          services.hostCommunication.send({
            type: "host.chat.switch",
            payload: { ticket_id: agentId, role: "user" },
          });
        }
      } else {
        controller.chat.activeThreadId = null;
        controller.chat.pendingChoices = [];
        controller.chat.selectedChoiceIds = [];
      }

      // If the selected agent has a bundle, ensure the iframe gets it.
      if (ticket?.tags?.includes("bundle")) {
        controller.stage.currentView = agentId;
        // Small delay to let Lit render the iframe element.
        await new Promise((r) => setTimeout(r, 100));
        await loadBundleAsync(agentId, services);
      }
    } else {
      controller.chat.activeThreadId = null;
      controller.chat.pendingChoices = [];
      controller.chat.selectedChoiceIds = [];
    }
  }
);
