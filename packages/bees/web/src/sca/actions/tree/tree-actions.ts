/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asAction, ActionMode } from "../../coordination.js";
import { makeAction } from "../binder.js";
import { loadBundleAsync } from "../../utils/load-bundle.js";
import { updateAgentHash } from "../../utils/agent-hash.js";
import { onAgentSelected } from "./tree-triggers.js";

export const bind = makeAction();

/**
 * Reacts to agent selection changes.
 *
 * Triggered whenever `controller.agentTree.selectedAgentId` changes.
 * Callers (UI components, other actions) set the field directly on the
 * controller — this action handles the side effects: URL hash sync,
 * chat thread switching, and bundle loading.
 */
export const syncAgentSelection = asAction(
  "Sync Agent Selection",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onAgentSelected(bind),
  },
  async () => {
    const { controller, services } = bind;
    const agentId = controller.agentTree.selectedAgentId;

    // Sync URL hash for deep linking.
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
        await loadBundleAsync(agentId, services, ticket.slug);
      }
    } else {
      controller.chat.activeThreadId = null;
      controller.chat.pendingChoices = [];
      controller.chat.selectedChoiceIds = [];
    }
  }
);
