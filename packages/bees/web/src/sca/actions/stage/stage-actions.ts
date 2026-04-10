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
          (t) => t.kind === "coordination" && t.signal_type === "digest_ready"
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
          await new Promise((r) => setTimeout(r, 100));
          const dSlug = digestTicket.slug;
          await loadBundleAsync(
            controller.stage.digestTicketId!,
            services,
            dSlug
          );
          digestLoading = false;
        }
      }
    }
  }
);

/**
 * Navigate to a ticket from an iframe-initiated event.
 *
 * Sets `selectedAgentId` on the controller — the `syncAgentSelection`
 * trigger in tree-actions handles chat sync, bundle loading, and
 * hash updates reactively.
 */
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
      const digestT = controller.global.tickets.find(
        (t) => t.id === controller.stage.digestTicketId
      );
      await loadBundleAsync(
        controller.stage.digestTicketId,
        services,
        digestT?.slug
      );
      return;
    }

    // Ignore internal iframe navigation events (e.g. "selection_step") that
    // don't correspond to a real ticket ID.
    const targetTicket = controller.global.tickets.find(
      (t) => t.id === ticketId
    );
    if (!targetTicket) return;

    // Set the field — syncAgentSelection handles the side effects.
    controller.agentTree.selectedAgentId = ticketId;
  }
);


