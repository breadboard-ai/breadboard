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

  describe("switchThread", () => {
    it("makes the requested thread active", async () => {
      controller.chat.threads = [
        {
          id: "opie",
          title: "Opie",
          ticketIds: [],
          activeTicketId: null,
          hasUnread: false,
        },
        {
          id: "123",
          title: "Research",
          ticketIds: [],
          activeTicketId: null,
          hasUnread: false,
        },
      ];
      controller.chat.activeThreadId = "opie";

      await ChatActions.switchThread(
        new CustomEvent("switch", { detail: "123" })
      );

      assert.equal(controller.chat.activeThreadId, "123");
      assert.ok(controller.chat.visitedThreadIds.has("123"));
    });

    it("resets pending choices and selection", async () => {
      controller.chat.threads = [
        {
          id: "opie",
          title: "Opie",
          ticketIds: [],
          activeTicketId: null,
          hasUnread: false,
        },
        {
          id: "123",
          title: "Research",
          ticketIds: [],
          activeTicketId: null,
          hasUnread: false,
        },
      ];
      controller.chat.activeThreadId = "opie";
      controller.chat.pendingChoices = [{ id: "c1", text: "Choice 1" }];
      controller.chat.selectedChoiceIds = ["c1"];

      await ChatActions.switchThread(
        new CustomEvent("switch", { detail: "123" })
      );

      assert.deepEqual(controller.chat.pendingChoices, []);
      assert.deepEqual(controller.chat.selectedChoiceIds, []);
    });
  });

  describe("sendChat", () => {
    it("sends active thread context over host communication", async () => {
      controller.chat.activeThreadId = "123";
      controller.chat.threads = [
        {
          id: "123",
          title: "Research",
          activeTicketId: "t-456",
          ticketIds: [],
          hasUnread: false,
        },
      ];

      // We must add the ticket to the global array so the action finds it
      controller.global.tickets = [
        {
          id: "t-456",
          status: "suspended",
          assignee: "user",
        } as unknown as import("../../../src/data/types.js").TicketData,
      ];

      await ChatActions.sendChat(
        new CustomEvent("chat", { detail: "Hello Opie" })
      );

      const respondMock = services.api.respond as unknown as ReturnType<
        typeof mock.fn
      >;
      assert.equal(respondMock.mock.calls.length, 1);
      const apiCallArgs = respondMock.mock.calls[0].arguments;
      assert.equal(apiCallArgs[0], "t-456");
      assert.equal(apiCallArgs[1], "Hello Opie");
    });
  });
});
