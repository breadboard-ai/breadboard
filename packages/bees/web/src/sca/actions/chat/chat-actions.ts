/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asAction, ActionMode } from "../../coordination.js";
import { makeAction } from "../binder.js";
import type { TicketData } from "../../../data/types.js";
import type { ChatThread, ChatMessage } from "../../types.js";
import { onTicketsUpdate } from "./chat-triggers.js";
import { extractPrompt, extractChoices } from "../../../utils.js";
import { loadBundleAsync } from "../../utils/load-bundle.js";

export const bind = makeAction();

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
    const groups = new Map<string, TicketData[]>();

    for (const t of chatTickets) {
      const threadId = t.tags?.includes("opie") ? "opie" : t.playbook_run_id;
      if (!threadId) continue;
      const list = groups.get(threadId) ?? [];
      list.push(t);
      groups.set(threadId, list);
    }

    const threads: ChatThread[] = [];

    for (const [threadId, group] of groups) {
      group.sort((a, b) =>
        (a.created_at ?? "").localeCompare(b.created_at ?? "")
      );

      const suspendedForUser = group.findLast(
        (t) => t.status === "suspended" && t.assignee === "user"
      );
      const runningOrQueued = group.findLast(
        (t) => t.status === "running" || t.status === "available"
      );
      const activeTicketId =
        suspendedForUser?.id ?? runningOrQueued?.id ?? null;

      let title: string;
      if (threadId === "opie") {
        title = "Opie";
      } else {
        const activeTicket = activeTicketId
          ? group.find((t) => t.id === activeTicketId)
          : null;

        // Prefer the ticket's own title (dynamically renamed by on_event
        // hooks) over the generic playbook ID.
        if (activeTicket?.title) {
          title = activeTicket.title;
        } else {
          const playbookId = activeTicket?.playbook_id ?? group[0]?.playbook_id;
          if (playbookId) {
            title = playbookId
              .replace(/-/g, " ")
              .split(" ")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
          } else {
            title = group[group.length - 1]?.title ?? threadId.slice(0, 8);
          }
        }
      }

      const hasUnread =
        threadId !== controller.chat.activeThreadId && suspendedForUser != null;

      threads.push({
        id: threadId,
        title,
        ticketIds: group.map((t) => t.id),
        activeTicketId,
        hasUnread,
      });
    }

    const oldThreads = controller.chat.threads;
    controller.chat.threads = threads;

    // Auto-switch to newly created journey only when the user explicitly
    // initiated a new journey from this browser tab.
    if (
      controller.chat.activeThreadId === "opie" &&
      controller.chat.awaitingNewThread
    ) {
      const newThread = threads.find(
        (t) => t.id !== "opie" && !oldThreads.some((old) => old.id === t.id)
      );
      if (newThread) {
        controller.chat.awaitingNewThread = false;
        await switchThreadSync(newThread.id);
        applyPromptState();
      }
    }

    // Restore chat history for any thread not yet restored
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
  let activeThreadCompleted = false;

  for (const thread of threads) {
    for (const ticketId of thread.ticketIds) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) continue;

      const currentStatus = `${ticket.status}:${ticket.assignee ?? ""}`;
      const previousStatus =
        controller.chat.previousTicketStatuses.get(ticketId);

      if (currentStatus !== previousStatus) {
        controller.chat.previousTicketStatuses.set(ticketId, currentStatus);

        // Track completion transitions on the active thread.
        if (
          thread.id === activeThreadId &&
          (ticket.status === "completed" || ticket.status === "failed")
        ) {
          activeThreadCompleted = true;
        }

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

          if (thread.id === controller.chat.activeThreadId) {
            applyPromptState();
          } else if (
            !controller.chat.visitedThreadIds.has(thread.id)
            // Note: chatInput check removed, needs handling via action params if necessary
          ) {
            await switchThreadSync(thread.id);
            applyPromptState();
          }

          if (!controller.chat.isOpen) {
            controller.chat.isOpen = true;
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

          if (!controller.chat.isOpen) controller.chat.isOpen = true;

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

  // Auto-switch to Opie when the active non-Opie thread's run completes —
  // keeps the user on a chat window where they can type.
  if (activeThreadCompleted && activeThreadId !== "opie") {
    const activeThread = threads.find((t) => t.id === activeThreadId);
    if (activeThread && !activeThread.activeTicketId) {
      await switchThreadSync("opie");
      applyPromptState();
    }
  }
}

function applyPromptState() {
  const { controller } = bind;
  const activeThreadId = controller.chat.activeThreadId;
  const thread = controller.chat.threads.find((t) => t.id === activeThreadId);
  if (!thread?.activeTicketId) {
    controller.chat.pendingChoices = [];
    return;
  }

  const ticket = controller.global.tickets.find(
    (t) => t.id === thread.activeTicketId
  );
  if (!ticket || ticket.status !== "suspended" || ticket.assignee !== "user") {
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

async function switchThreadSync(threadId: string) {
  const { controller, services } = bind;
  if (controller.chat.activeThreadId === threadId) return;

  controller.chat.activeThreadId = threadId;
  controller.chat.visitedThreadIds.add(threadId);

  controller.chat.pendingChoices = [];
  controller.chat.selectedChoiceIds = [];

  const thread = controller.chat.threads.find((t) => t.id === threadId);
  if (thread?.hasUnread) {
    controller.chat.threads = controller.chat.threads.map((t) =>
      t.id === threadId ? { ...t, hasUnread: false } : t
    );
  }

  if (thread && thread.activeTicketId) {
    services.hostCommunication.send({
      type: "host.chat.switch",
      payload: { ticket_id: thread.activeTicketId, role: "user" },
    });
  }

  // Sync the stage canvas to match the active thread.
  await syncStageToChat(threadId);
}

/**
 * When the chat thread changes, update the stage canvas to show the
 * corresponding app (or the digest for the Opie thread).
 */
async function syncStageToChat(threadId: string) {
  const { controller, services } = bind;
  const stage = controller.stage;

  // Opie thread → show the digest.
  if (threadId === "opie") {
    if (stage.digestTicketId && stage.currentView !== stage.digestTicketId) {
      stage.currentView = stage.digestTicketId;
      await new Promise((r) => setTimeout(r, 100)); // wait for iframe mount
      await loadBundleAsync(stage.digestTicketId, services);
    } else if (
      !stage.digestTicketId &&
      stage.currentView !== null &&
      stage.currentView !== "digest"
    ) {
      stage.currentView = null;
    }
    return;
  }

  // App thread → sync view.
  const thread = controller.chat.threads.find((t) => t.id === threadId);
  if (!thread?.activeTicketId) return;

  const ticket = controller.global.tickets.find(
    (t) => t.id === thread.activeTicketId
  );

  if (stage.currentView !== thread.activeTicketId) {
    stage.currentView = thread.activeTicketId;

    if (ticket?.tags?.includes("bundle")) {
      await new Promise((r) => setTimeout(r, 100)); // wait for iframe mount
      await loadBundleAsync(thread.activeTicketId, services);
    }
  }
}

// ── Manual Triggers (Bound to UI Elements) ──────────────────

export const switchThread = asAction(
  "Switch Thread",
  { mode: ActionMode.Immediate },
  async (evt?: Event) => {
    if (!evt) return;
    const threadId = (evt as CustomEvent<string>).detail;
    await switchThreadSync(threadId);
    applyPromptState();
  }
);

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
    const thread = controller.chat.threads.find((t) => t.id === activeThreadId);

    // Add immediate user message to the UI.
    const threadMessages =
      controller.chat.threadMessages.get(activeThreadId) ?? [];
    const updated = new Map(controller.chat.threadMessages);
    updated.set(activeThreadId, [...threadMessages, { text, role: "user" }]);
    controller.chat.threadMessages = updated;

    if (thread?.activeTicketId) {
      // Resume an existing suspended ticket.
      await services.api.respond(thread.activeTicketId, text);
    } else {
      // No active ticket — create a new one (e.g. cold-start Opie chat).
      controller.chat.awaitingNewThread = true;
      await services.api.addTicket(text, ["chat", "opie"]);
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

    await services.api.respond(thread.activeTicketId, labels, ids);
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
