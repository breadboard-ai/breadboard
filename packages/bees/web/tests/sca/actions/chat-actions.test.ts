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

  describe("chat → stage sync", () => {
    it("switches stage to app bundle when switching to an app thread", async () => {
      const ticket = {
        id: "t-app",
        status: "suspended",
        assignee: "user",
        tags: ["chat", "bundle"],
        playbook_run_id: "run-1",
      } as unknown as import("../../../src/data/types.js").TicketData;

      controller.global.tickets = [ticket];
      controller.chat.threads = [
        {
          id: "opie",
          title: "Opie",
          ticketIds: [],
          activeTicketId: null,
          hasUnread: false,
        },
        {
          id: "run-1",
          title: "My App",
          ticketIds: ["t-app"],
          activeTicketId: "t-app",
          hasUnread: false,
        },
      ];
      controller.chat.activeThreadId = "opie";

      mock.method(services.api, "listFiles", async () => ["app.js"]);
      mock.method(services.api, "getFile", async () => "console.log('app')");

      await ChatActions.switchThread(
        new CustomEvent("switch", { detail: "run-1" })
      );

      assert.equal(controller.stage.currentView, "t-app");

      const sendMock = services.hostCommunication.send as unknown as ReturnType<
        typeof mock.fn
      >;
      // One call for host.chat.switch, one for render
      const renderCall = sendMock.mock.calls.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c.arguments[0].type === "render"
      );
      assert.ok(renderCall, "Expected a render message to be sent");
    });

    it("switches stage to digest when switching to Opie thread", async () => {
      controller.stage.digestTicketId = "t-digest";
      controller.stage.currentView = "t-app";

      controller.chat.threads = [
        {
          id: "opie",
          title: "Opie",
          ticketIds: [],
          activeTicketId: null,
          hasUnread: false,
        },
        {
          id: "run-1",
          title: "My App",
          ticketIds: ["t-app"],
          activeTicketId: "t-app",
          hasUnread: false,
        },
      ];
      controller.chat.activeThreadId = "run-1";

      mock.method(services.api, "listFiles", async () => ["digest.js"]);
      mock.method(
        services.api,
        "getFile",
        async () => "console.log('digest')"
      );

      await ChatActions.switchThread(
        new CustomEvent("switch", { detail: "opie" })
      );

      assert.equal(controller.stage.currentView, "t-digest");
    });

    it("does not change stage when thread has no bundle-tagged ticket", async () => {
      const ticket = {
        id: "t-chat-only",
        status: "suspended",
        assignee: "user",
        tags: ["chat"],
        playbook_run_id: "run-2",
      } as unknown as import("../../../src/data/types.js").TicketData;

      controller.global.tickets = [ticket];
      controller.stage.currentView = "t-digest";
      controller.chat.threads = [
        {
          id: "opie",
          title: "Opie",
          ticketIds: [],
          activeTicketId: null,
          hasUnread: false,
        },
        {
          id: "run-2",
          title: "Chat Only",
          ticketIds: ["t-chat-only"],
          activeTicketId: "t-chat-only",
          hasUnread: false,
        },
      ];
      controller.chat.activeThreadId = "opie";

      await ChatActions.switchThread(
        new CustomEvent("switch", { detail: "run-2" })
      );

      // Stage should remain unchanged — ticket has no "bundle" tag.
      assert.equal(controller.stage.currentView, "t-digest");
    });
  });
});
