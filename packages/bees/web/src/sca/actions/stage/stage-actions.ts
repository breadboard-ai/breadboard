/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asAction, ActionMode } from "../../coordination.js";
import { makeAction } from "../binder.js";
import { onTicketsUpdate } from "../chat/chat-triggers.js";
import { onIframeNavigate } from "./stage-triggers.js";
import { loadBundleAsync } from "../../utils/load-bundle.js";

export const bind = makeAction();

// Module-level ephemeral state
let lastDigestUpdateId: string | null = null;
let lastDigestBuildingId: string | null = null;
let digestLoading = false;



export const processDigestUpdates = asAction(
  "Process Digest Updates",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onTicketsUpdate(bind),
  },
  async () => {
    const { controller, services } = bind;
    const tickets = controller.global.tickets;

    const digestTicket = tickets.find(
      (t) =>
        t.kind !== "coordination" &&
        t.tags?.includes("digest") &&
        (t.status === "suspended" || t.status === "completed")
    );

    if (digestTicket && !digestLoading) {
      if (!controller.stage.digestTicketId) {
        controller.stage.digestTicketId = digestTicket.id;
      }

      const allBuildingSignals = tickets
        .filter(
          (t) =>
            t.kind === "coordination" && t.signal_type === "digest_building"
        )
        .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      const latestBuilding = allBuildingSignals[allBuildingSignals.length - 1];
      if (latestBuilding && latestBuilding.id !== lastDigestBuildingId) {
        lastDigestBuildingId = latestBuilding.id;
      }

      const allDigestUpdates = tickets
        .filter(
          (t) => t.kind === "coordination" && t.signal_type === "digest_update"
        )
        .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      const latest = allDigestUpdates[allDigestUpdates.length - 1];
      const hasNewUpdate = latest != null && latest.id !== lastDigestUpdateId;

      if (hasNewUpdate) lastDigestUpdateId = latest.id;

      if (hasNewUpdate) {
        if (controller.stage.currentView === null) {
          controller.stage.currentView = controller.stage.digestTicketId;
        }

        if (controller.stage.currentView === controller.stage.digestTicketId) {
          digestLoading = true;
          // Must wait for UI to ensure iframe is ready before loading
          // In SCA, actions can dispatch, but we may need a small delay if the
          // view just changed so Lit can render the generic <iframe> tag.
          // For safety, we rely on the component firing a `load_bundle` action
          // when its iframe connects, OR we just await a small macro-task.
          await new Promise((r) => setTimeout(r, 100));
          await loadBundleAsync(controller.stage.digestTicketId!, services);
          digestLoading = false;
        }
      }
    }
  }
);

export const navigateToTicket = asAction(
  "Navigate To Ticket",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onIframeNavigate(bind),
  },
  async (evt?: Event) => {
    if (!evt) return;
    const detail = (evt as CustomEvent).detail;
    // Handle both IframeMessage and direct string payloads
    const ticketId = typeof detail === "string" ? detail : detail?.viewId;
    if (!ticketId) return;
    const { controller, services } = bind;

    if (ticketId === "digest" && controller.stage.digestTicketId) {
      controller.stage.currentView = controller.stage.digestTicketId;
      await new Promise((r) => setTimeout(r, 100)); // wait for iframe mount
      await loadBundleAsync(controller.stage.digestTicketId, services);
      syncChatToStage(ticketId);
      return;
    }

    controller.stage.currentView = ticketId;
    await new Promise((r) => setTimeout(r, 100)); // wait for iframe mount
    await loadBundleAsync(ticketId, services);
    syncChatToStage(ticketId);
  }
);

/**
 * When the stage navigates to a ticket, silently switch the chat
 * thread to the one containing that ticket.
 */
function syncChatToStage(ticketId: string) {
  const { controller, services } = bind;
  const chat = controller.chat;

  // "digest" navigation maps to the Opie thread.
  if (ticketId === "digest") {
    if (chat.activeThreadId !== "opie") {
      chat.activeThreadId = "opie";
      chat.visitedThreadIds.add("opie");
      chat.pendingChoices = [];
      chat.selectedChoiceIds = [];
    }
    return;
  }

  const matchingThread = chat.threads.find((t) =>
    t.ticketIds.includes(ticketId)
  );
  if (!matchingThread || matchingThread.id === chat.activeThreadId) return;

  chat.activeThreadId = matchingThread.id;
  chat.visitedThreadIds.add(matchingThread.id);
  chat.pendingChoices = [];
  chat.selectedChoiceIds = [];

  if (matchingThread.hasUnread) {
    chat.threads = chat.threads.map((t) =>
      t.id === matchingThread.id ? { ...t, hasUnread: false } : t
    );
  }

  if (matchingThread.activeTicketId) {
    services.hostCommunication.send({
      type: "host.chat.switch",
      payload: {
        ticket_id: matchingThread.activeTicketId,
        role: "user",
      },
    });
  }
}

export const navigateToDigest = asAction(
  "Navigate To Digest",
  { mode: ActionMode.Immediate },
  async () => {
    const { controller } = bind;
    if (controller.stage.digestTicketId) {
      await navigateToTicket(new CustomEvent("navigate", { detail: "digest" }));
    }
  }
);
