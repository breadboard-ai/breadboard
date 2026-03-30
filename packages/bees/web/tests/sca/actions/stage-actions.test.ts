/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

import * as StageActions from "../../../src/sca/actions/stage/stage-actions.js";
import { makeTestController } from "../helpers/mock-controller.js";
import { makeTestServices } from "../helpers/mock-services.js";
import type { AppController, AppServices } from "../../../src/sca/types.js";

describe("Stage Actions", () => {
  let controller: AppController;
  let services: AppServices;

  beforeEach(() => {
    ({ controller } = makeTestController());
    ({ services } = makeTestServices());

    StageActions.bind({ controller, services });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe("navigateToTicket", () => {
    it("sets the current view to the requested ticket and loads the bundle", async () => {
      mock.method(services.api, "listFiles", async (_ticketId: string) => {
        return ["bundle.js", "bundle.css"];
      });

      mock.method(
        services.api,
        "getFile",
        async (_ticketId: string, filename: string) => {
          if (filename === "bundle.js") return "console.log('js')";
          if (filename === "bundle.css") return "body { color: red }";
          return null;
        }
      );

      await StageActions.navigateToTicket(
        new CustomEvent("navigate", { detail: "t-123" })
      );

      assert.equal(controller.stage.currentView, "t-123");

      const sendMock = services.hostCommunication.send as unknown as ReturnType<
        typeof mock.fn
      >;
      assert.equal(sendMock.mock.calls.length, 1);
      const args = sendMock.mock.calls[0].arguments;
      assert.deepEqual(args[0], {
        type: "render",
        code: "console.log('js')",
        css: "body { color: red }",
        props: {},
        assets: {},
      });
    });

    it("sets the current view from an IframeMessage payload detail object", async () => {
      mock.method(services.api, "listFiles", async (_ticketId: string) => {
        return ["bundle.js", "bundle.css"];
      });

      mock.method(
        services.api,
        "getFile",
        async (_ticketId: string, filename: string) => {
          if (filename === "bundle.js") return "console.log('js')";
          return null;
        }
      );

      await StageActions.navigateToTicket(
        new CustomEvent("navigate", {
          detail: { type: "navigate", viewId: "t-456" },
        })
      );

      assert.equal(controller.stage.currentView, "t-456");
    });
  });
});
