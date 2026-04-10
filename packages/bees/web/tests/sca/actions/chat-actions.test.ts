/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

import * as ChatActions from "../../../src/sca/actions/chat/chat-actions.js";
import { makeTestController } from "../helpers/mock-controller.js";
import { makeTestServices } from "../helpers/mock-services.js";
import type { AppController, AppServices } from "../../../src/sca/types.js";
import type { TicketData } from "../../../../common/types.js";

function ticket(
  overrides: Partial<TicketData> & { id: string }
): TicketData {
  return {
    objective: "",
    status: "completed",
    ...overrides,
  } as TicketData;
}

describe("Chat Actions", () => {
  let controller: AppController;
  let services: AppServices;

  beforeEach(() => {
    ({ controller } = makeTestController());
    ({ services } = makeTestServices());

    ChatActions.bind({ controller, services });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe("deriveThreads", () => {
    it("creates one thread per chat-tagged ticket", async () => {
      controller.global.tickets = [
        ticket({ id: "t-1", tags: ["chat"], status: "running" }),
        ticket({ id: "t-2", tags: ["chat"], status: "completed" }),
        ticket({ id: "t-3", tags: ["bundle"] }), // not a chat ticket
      ];

      await ChatActions.deriveThreads();

      assert.equal(controller.chat.threads.length, 2);
      assert.equal(controller.chat.threads[0].id, "t-1");
      assert.equal(controller.chat.threads[1].id, "t-2");
    });

    it("thread ID is the ticket ID, not playbook_run_id", async () => {
      controller.global.tickets = [
        ticket({
          id: "t-1",
          tags: ["chat"],
          playbook_run_id: "run-abc",
          status: "running",
        }),
      ];

      await ChatActions.deriveThreads();

      assert.equal(controller.chat.threads[0].id, "t-1");
    });

    it("treats opie-tagged tickets the same as any other", async () => {
      controller.global.tickets = [
        ticket({
          id: "t-opie",
          tags: ["chat", "opie"],
          status: "suspended",
          assignee: "user",
        }),
        ticket({
          id: "t-agent",
          tags: ["chat"],
          status: "running",
        }),
      ];

      await ChatActions.deriveThreads();

      assert.equal(controller.chat.threads.length, 2);
      // Both threads use their ticket ID — no "opie" string constant.
      const ids = controller.chat.threads.map((t) => t.id);
      assert.ok(ids.includes("t-opie"));
      assert.ok(ids.includes("t-agent"));
    });

    it("marks suspended-for-user tickets as active", async () => {
      controller.global.tickets = [
        ticket({
          id: "t-1",
          tags: ["chat"],
          status: "suspended",
          assignee: "user",
        }),
      ];

      await ChatActions.deriveThreads();

      assert.equal(controller.chat.threads[0].activeTicketId, "t-1");
    });

    it("marks running tickets as active", async () => {
      controller.global.tickets = [
        ticket({ id: "t-1", tags: ["chat"], status: "running" }),
      ];

      await ChatActions.deriveThreads();

      assert.equal(controller.chat.threads[0].activeTicketId, "t-1");
    });

    it("marks completed tickets as inactive", async () => {
      controller.global.tickets = [
        ticket({ id: "t-1", tags: ["chat"], status: "completed" }),
      ];

      await ChatActions.deriveThreads();

      assert.equal(controller.chat.threads[0].activeTicketId, null);
    });

    it("detects unread for non-active threads with suspended user", async () => {
      controller.chat.activeThreadId = "t-1";
      controller.global.tickets = [
        ticket({
          id: "t-1",
          tags: ["chat"],
          status: "running",
        }),
        ticket({
          id: "t-2",
          tags: ["chat"],
          status: "suspended",
          assignee: "user",
        }),
      ];

      await ChatActions.deriveThreads();

      const t2 = controller.chat.threads.find((t) => t.id === "t-2");
      assert.ok(t2?.hasUnread);
    });

    it("restores chat history from ticket data", async () => {
      controller.global.tickets = [
        ticket({
          id: "t-1",
          tags: ["chat"],
          status: "completed",
          chat_history: [
            { role: "user", text: "Hello" },
            { role: "agent", text: "Hi there" },
          ],
        }),
      ];

      await ChatActions.deriveThreads();

      const messages = controller.chat.threadMessages.get("t-1");
      assert.ok(messages);
      assert.equal(messages.length, 2);
      assert.equal(messages[0].text, "Hello");
      assert.equal(messages[1].text, "Hi there");
    });

    it("derives title from ticket title", async () => {
      controller.global.tickets = [
        ticket({
          id: "t-1",
          tags: ["chat"],
          title: "My Research Agent",
          status: "running",
        }),
      ];

      await ChatActions.deriveThreads();

      assert.equal(controller.chat.threads[0].title, "My Research Agent");
    });

    it("falls back to playbook_id for title", async () => {
      controller.global.tickets = [
        ticket({
          id: "t-1",
          tags: ["chat"],
          playbook_id: "deep-research",
          status: "running",
        }),
      ];

      await ChatActions.deriveThreads();

      assert.equal(controller.chat.threads[0].title, "Deep Research");
    });
  });

  describe("sendChat", () => {
    it("responds to the active thread's ticket", async () => {
      controller.chat.activeThreadId = "t-1";
      controller.chat.threads = [
        {
          id: "t-1",
          title: "Agent",
          activeTicketId: "t-1",
          ticketIds: ["t-1"],
          hasUnread: false,
        },
      ];
      controller.global.tickets = [
        ticket({
          id: "t-1",
          tags: ["chat"],
          status: "suspended",
          assignee: "user",
        }),
      ];

      await ChatActions.sendChat(
        new CustomEvent("chat", { detail: "Hello" })
      );

      const respondMock = services.api.respond as unknown as ReturnType<
        typeof mock.fn
      >;
      assert.equal(respondMock.mock.calls.length, 1);
      assert.equal(respondMock.mock.calls[0].arguments[0], "t-1");
      assert.equal(respondMock.mock.calls[0].arguments[1], "Hello");
    });

    it("appends user message to thread messages immediately", async () => {
      controller.chat.activeThreadId = "t-1";
      controller.chat.threads = [
        {
          id: "t-1",
          title: "Agent",
          activeTicketId: "t-1",
          ticketIds: ["t-1"],
          hasUnread: false,
        },
      ];

      await ChatActions.sendChat(
        new CustomEvent("chat", { detail: "Test message" })
      );

      const messages = controller.chat.threadMessages.get("t-1");
      assert.ok(messages);
      assert.equal(messages[messages.length - 1].text, "Test message");
      assert.equal(messages[messages.length - 1].role, "user");
    });

    it("does nothing when no active thread", async () => {
      controller.chat.activeThreadId = null;

      await ChatActions.sendChat(
        new CustomEvent("chat", { detail: "Hello" })
      );

      const respondMock = services.api.respond as unknown as ReturnType<
        typeof mock.fn
      >;
      assert.equal(respondMock.mock.calls.length, 0);
    });
  });

  describe("sendChoices", () => {
    it("sends selected choice IDs to the active ticket", async () => {
      controller.chat.activeThreadId = "t-1";
      controller.chat.threads = [
        {
          id: "t-1",
          title: "Agent",
          activeTicketId: "t-1",
          ticketIds: ["t-1"],
          hasUnread: false,
        },
      ];
      controller.chat.pendingChoices = [
        { id: "c1", text: "Option A" },
        { id: "c2", text: "Option B" },
      ];

      await ChatActions.sendChoices(
        new CustomEvent("choices", { detail: ["c1"] })
      );

      const respondMock = services.api.respond as unknown as ReturnType<
        typeof mock.fn
      >;
      assert.equal(respondMock.mock.calls.length, 1);
      assert.equal(respondMock.mock.calls[0].arguments[0], "t-1");
      assert.equal(respondMock.mock.calls[0].arguments[1], "Option A");
      assert.deepEqual(respondMock.mock.calls[0].arguments[2], ["c1"]);
    });

    it("clears pending choices after sending", async () => {
      controller.chat.activeThreadId = "t-1";
      controller.chat.threads = [
        {
          id: "t-1",
          title: "Agent",
          activeTicketId: "t-1",
          ticketIds: ["t-1"],
          hasUnread: false,
        },
      ];
      controller.chat.pendingChoices = [{ id: "c1", text: "A" }];

      await ChatActions.sendChoices(
        new CustomEvent("choices", { detail: ["c1"] })
      );

      assert.deepEqual(controller.chat.pendingChoices, []);
      assert.deepEqual(controller.chat.selectedChoiceIds, []);
    });
  });
});
