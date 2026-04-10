/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

import * as StageActions from "../../../src/sca/actions/stage/stage-actions.js";
import * as TreeActions from "../../../src/sca/actions/tree/tree-actions.js";
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

describe("Stage Actions", () => {
  let controller: AppController;
  let services: AppServices;

  beforeEach(() => {
    ({ controller } = makeTestController());
    ({ services } = makeTestServices());

    // navigateToTicket → selectAgent → applyPromptState crosses all three.
    StageActions.bind({ controller, services });
    TreeActions.bind({ controller, services });
    ChatActions.bind({ controller, services });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe("navigateToTicket", () => {
    it("delegates to selectAgent for known tickets", async () => {
      const t = ticket({
        id: "t-123",
        tags: ["chat", "bundle"],
        status: "suspended",
        assignee: "user",
      });
      controller.global.tickets = [t];

      mock.method(services.api, "listFiles", async () => ["bundle.js"]);
      mock.method(services.api, "getFile", async () => "console.log('js')");

      await StageActions.navigateToTicket(
        new CustomEvent("navigate", { detail: "t-123" })
      );

      // selectAgent sets the selected agent and syncs chat.
      assert.equal(controller.agentTree.selectedAgentId, "t-123");
      assert.equal(controller.chat.activeThreadId, "t-123");
    });

    it("handles IframeMessage payload detail objects", async () => {
      const t = ticket({
        id: "t-456",
        tags: ["chat"],
        status: "running",
      });
      controller.global.tickets = [t];

      await StageActions.navigateToTicket(
        new CustomEvent("navigate", {
          detail: { type: "navigate", viewId: "t-456" },
        })
      );

      assert.equal(controller.agentTree.selectedAgentId, "t-456");
    });

    it("ignores navigation to unknown ticket IDs", async () => {
      controller.global.tickets = [];

      await StageActions.navigateToTicket(
        new CustomEvent("navigate", { detail: "t-unknown" })
      );

      assert.equal(controller.agentTree.selectedAgentId, null);
    });

    it("navigates to digest without changing agent selection", async () => {
      controller.stage.digestTicketId = "t-digest";
      controller.agentTree.selectedAgentId = "t-agent";

      mock.method(services.api, "listFiles", async () => ["digest.js"]);
      mock.method(services.api, "getFile", async () => "console.log('d')");

      await StageActions.navigateToTicket(
        new CustomEvent("navigate", { detail: "digest" })
      );

      // Digest navigation sets the stage view but doesn't change the
      // agent tree selection.
      assert.equal(controller.stage.currentView, "t-digest");
      assert.equal(controller.agentTree.selectedAgentId, "t-agent");
    });
  });
});
