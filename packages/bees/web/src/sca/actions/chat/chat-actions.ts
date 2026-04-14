/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asAction, ActionMode } from "../../coordination.js";
import { makeAction } from "../binder.js";
import type { TicketData } from "../../../../../common/types.js";
import type { ChatThread, ChatMessage } from "../../types.js";
import { onTicketsUpdate, onActiveThreadChange } from "./chat-triggers.js";
import { extractPrompt, extractChoices } from "../../../../../common/utils.js";

export const bind = makeAction();

/**
 * Derive chat threads from tickets.
 *
 * Each chat-tagged ticket is its own thread, keyed by ticket ID.
 * No playbook_run_id grouping, no Opie special-casing — every agent
 * is treated uniformly.
 */
export const deriveThreads = asAction(
  "Derive Threads",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onTicketsUpdate(bind),
  },
  async () => {
    const { controller } = bind;
    const tickets = controller.global.tickets;
    const chatTickets = tickets.filter((t) => t.tags?.includes("chat"));

    const threads: ChatThread[] = [];

    for (const t of chatTickets) {
      const suspendedForUser =
        t.status === "suspended" && t.assignee === "user";
      const isActive =
        suspendedForUser ||
        t.status === "running" ||
        t.status === "available";

      const title =
        t.title ||
        t.playbook_id
          ?.replace(/-/g, " ")
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ") ||
        t.id.slice(0, 8);

      const hasUnread =
        t.id !== controller.chat.activeThreadId && suspendedForUser;

      threads.push({
        id: t.id,
        title,
        ticketIds: [t.id],
        activeTicketId: isActive ? t.id : null,
        hasUnread,
      });
    }

    controller.chat.threads = threads;

    // Restore chat history for any thread not yet restored.
    for (const thread of threads) {
      if (!controller.chat.restoredThreadIds.has(thread.id)) {
        controller.chat.restoredThreadIds.add(thread.id);
        restoreThreadHistory(thread, tickets);
      }
    }

    await processTicketTransitions(threads, tickets);
  }
);

function restoreThreadHistory(thread: ChatThread, tickets: TicketData[]) {
  const { controller } = bind;
  const messages: ChatMessage[] = [];

  for (const ticketId of thread.ticketIds) {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) continue;

    controller.chat.previousTicketStatuses.set(
      ticketId,
      `${ticket.status}:${ticket.assignee ?? ""}`
    );

    if (!ticket.chat_history?.length) continue;
    for (const m of ticket.chat_history) {
      messages.push({
        text: m.text,
        role: m.role as ChatMessage["role"],
      });
    }
  }

  if (messages.length > 0) {
    const updated = new Map(controller.chat.threadMessages);
    updated.set(thread.id, messages);
    controller.chat.threadMessages = updated;
  }
}

async function processTicketTransitions(
  threads: ChatThread[],
  tickets: TicketData[]
) {
  const { controller } = bind;
  const activeThreadId = controller.chat.activeThreadId;

  for (const thread of threads) {
    for (const ticketId of thread.ticketIds) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) continue;

      const currentStatus = `${ticket.status}:${ticket.assignee ?? ""}`;
      const previousStatus =
        controller.chat.previousTicketStatuses.get(ticketId);

      if (currentStatus !== previousStatus) {
        controller.chat.previousTicketStatuses.set(ticketId, currentStatus);

        // Suspended for User transition
        if (ticket.status === "suspended" && ticket.assignee === "user") {
          const prompt = extractPrompt(ticket);

          // Skip the useless fallback — real conversation text is already
          // in chat_history and gets restored by restoreThreadHistory.
          if (prompt !== "(no prompt)") {
            const threadMessages =
              controller.chat.threadMessages.get(thread.id) ?? [];
            const updated = new Map(controller.chat.threadMessages);
            updated.set(thread.id, [
              ...threadMessages,
              { text: prompt, role: "agent" },
            ]);
            controller.chat.threadMessages = updated;
          }

          if (thread.id === activeThreadId) {
            applyPromptState();
          }

          // Auto-expand the float when an agent needs user input.
          if (controller.chat.isMinimized) {
            controller.chat.hasUnreadFloat = true;
          }
        }

        // Failure transition -> Post error message and Global Toast!
        if (ticket.status === "failed" && ticket.error) {
          const raw = ticket.error as string;
          const match = raw.match(/"message":\s*"([^"]+)"/);
          const summary = match?.[1] ?? raw.slice(0, 200);

          const threadMessages =
            controller.chat.threadMessages.get(thread.id) ?? [];
          const updated = new Map(controller.chat.threadMessages);
          updated.set(thread.id, [
            ...threadMessages,
            {
              text: `Something went wrong: ${summary}`,
              role: "error",
            },
          ]);
          controller.chat.threadMessages = updated;

          // Propagate error to global toasts
          const toasts = controller.global.toasts;
          controller.global.toasts = [
            ...toasts,
            {
              id: crypto.randomUUID(),
              message: `Task failed: ${summary}`,
              type: "error",
              timeoutMs: 10000,
            },
          ];
        }
      }
    }
  }
}

/**
 * Apply prompt state for the active thread — sets up pending choices
 * when the active agent is suspended for user input.
 *
 * Triggered by `activeThreadId` changes (e.g. when the tree action
 * selects a new agent). This replaces the prior cross-action import.
 */
export const applyPromptState = asAction(
  "Apply Prompt State",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onActiveThreadChange(bind),
  },
  async () => {
    const { controller } = bind;
    const activeThreadId = controller.chat.activeThreadId;
    if (!activeThreadId) {
      controller.chat.pendingChoices = [];
      return;
    }
    const thread = controller.chat.threads.find(
      (t) => t.id === activeThreadId
    );
    if (!thread?.activeTicketId) {
      controller.chat.pendingChoices = [];
      return;
    }

    const ticket = controller.global.tickets.find(
      (t) => t.id === thread.activeTicketId
    );
    if (
      !ticket ||
      ticket.status !== "suspended" ||
      ticket.assignee !== "user"
    ) {
      controller.chat.pendingChoices = [];
      return;
    }

    const choices = extractChoices(ticket);
    if (choices.length > 0) {
      const selectionMode =
        ((ticket.suspend_event?.waitForChoice as Record<string, unknown>)
          ?.selectionMode as string) ?? "single";
      controller.chat.pendingChoices = choices;
      controller.chat.pendingSelectionMode =
        selectionMode === "multiple" ? "multiple" : "single";
      controller.chat.selectedChoiceIds = [];
    } else {
      controller.chat.pendingChoices = [];
    }
  }
);

// ── Manual Triggers (Bound to UI Elements) ──────────────────

export const retryTicket = asAction(
  "Retry Ticket",
  { mode: ActionMode.Immediate },
  async (evt?: Event) => {
    if (!evt) return;
    const { services } = bind;
    const ticketId = (evt as CustomEvent<string>).detail;
    if (!ticketId) return;
    await services.api.retry(ticketId);
  }
);

export const sendChat = asAction(
  "Send Chat",
  { mode: ActionMode.Immediate },
  async (evt?: Event) => {
    if (!evt) return;
    const { controller, services } = bind;
    const text = (evt as CustomEvent<string>).detail;
    if (!text) return;

    const activeThreadId = controller.chat.activeThreadId;
    if (!activeThreadId) return;

    const thread = controller.chat.threads.find((t) => t.id === activeThreadId);

    // Add immediate user message to the UI.
    const threadMessages =
      controller.chat.threadMessages.get(activeThreadId) ?? [];
    const updated = new Map(controller.chat.threadMessages);
    updated.set(activeThreadId, [...threadMessages, { text, role: "user" }]);
    controller.chat.threadMessages = updated;

    if (thread?.activeTicketId) {
      await services.api.reply(thread.activeTicketId, text);
    }
  }
);

export const sendChoices = asAction(
  "Send Choices",
  { mode: ActionMode.Immediate },
  async (evt?: Event) => {
    if (!evt) return;
    const { controller, services } = bind;
    const ids = (evt as CustomEvent<string[]>).detail;
    if (!ids || ids.length === 0) return;

    const thread = controller.chat.threads.find(
      (t) => t.id === controller.chat.activeThreadId
    );
    if (!thread?.activeTicketId) return;

    const labels = ids
      .map(
        (id) =>
          controller.chat.pendingChoices.find((c) => c.id === id)?.text ?? id
      )
      .join(", ");

    const threadMessages = controller.chat.threadMessages.get(thread.id) ?? [];
    const updated = new Map(controller.chat.threadMessages);
    updated.set(thread.id, [...threadMessages, { text: labels, role: "user" }]);
    controller.chat.threadMessages = updated;

    controller.chat.pendingChoices = [];
    controller.chat.selectedChoiceIds = [];

    await services.api.choose(thread.activeTicketId, ids);
  }
);

export const processHostSessionEvent = asAction(
  "Process Host Session Event",
  { mode: ActionMode.Immediate },
  async (evt?: Event) => {
    if (!evt) return;
    const { controller } = bind;
    const data = (evt as CustomEvent<Record<string, unknown>>).detail;
    const ticketId = data.ticket_id as string;
    const event = data.event as Record<string, unknown>;

    const thread = controller.chat.threads.find(
      (t) => t.id === controller.chat.activeThreadId
    );
    if (!thread || !thread.ticketIds.includes(ticketId)) return;

    if ("thought" in event) {
      const thought = event.thought as Record<string, unknown>;
      const text = thought.text as string;
      if (text) {
        const threadMessages =
          controller.chat.threadMessages.get(thread.id) ?? [];
        const updated = new Map(controller.chat.threadMessages);
        updated.set(thread.id, [
          ...threadMessages,
          { text: `💭 ${text}`, role: "thought" },
        ]);
        controller.chat.threadMessages = updated;
      }
    }

    if ("functionCall" in event) {
      const fc = event.functionCall as Record<string, unknown>;
      const name = fc.name as string;
      if (name) {
        const threadMessages =
          controller.chat.threadMessages.get(thread.id) ?? [];
        const updated = new Map(controller.chat.threadMessages);
        updated.set(thread.id, [
          ...threadMessages,
          { text: `🔧 ${name}`, role: "tool" },
        ]);
        controller.chat.threadMessages = updated;
      }
    }
  }
);
