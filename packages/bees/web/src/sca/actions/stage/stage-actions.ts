/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asAction, ActionMode } from "../../coordination.js";
import { makeAction } from "../binder.js";
import { onTicketsUpdate } from "../chat/chat-triggers.js";
import { onIframeNavigate } from "./stage-triggers.js";

export const bind = makeAction();

// Module-level ephemeral state
let lastDigestUpdateId: string | null = null;
let lastDigestBuildingId: string | null = null;
let digestLoading = false;

async function loadBundleAsync(ticketId: string) {
  const { services } = bind;
  const files = await services.api.listFiles(ticketId);

  const jsFile = files.find((f) => f.endsWith(".js"));
  if (!jsFile) {
    console.error(`[opal-shell] No JS file found for ticket ${ticketId}`);
    return;
  }

  const code = await services.api.getFile(ticketId, jsFile);
  if (!code) {
    console.error(
      `[opal-shell] Failed to load ${jsFile} for ticket ${ticketId}`
    );
    return;
  }

  const cssFile = files.find((f) => f.endsWith(".css"));
  const css = cssFile ? await services.api.getFile(ticketId, cssFile) : null;

  await services.hostCommunication.send({
    type: "render",
    code,
    css: css || undefined,
    props: {},
    assets: {},
  });
}

export const processDigestUpdates = asAction(
  "Process Digest Updates",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onTicketsUpdate(bind),
  },
  async () => {
    const { controller } = bind;
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
          await loadBundleAsync(controller.stage.digestTicketId!);
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
    const { controller } = bind;

    if (ticketId === "digest" && controller.stage.digestTicketId) {
      controller.stage.currentView = controller.stage.digestTicketId;
      await new Promise((r) => setTimeout(r, 100)); // wait for iframe mount
      await loadBundleAsync(controller.stage.digestTicketId);
      return;
    }

    controller.stage.currentView = ticketId;
    await new Promise((r) => setTimeout(r, 100)); // wait for iframe mount
    await loadBundleAsync(ticketId);
  }
);

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
