/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, beforeEach, before, after } from "node:test";
import * as Host from "../../../../src/sca/actions/host/host-actions.js";
import { coordination } from "../../../../src/sca/coordination.js";
import type { AppController } from "../../../../src/sca/controller/controller.js";
import type { AppServices } from "../../../../src/sca/services/services.js";
import { StateEvent } from "../../../../src/ui/events/events.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";

suite("Host Actions — Event-Triggered", () => {
  interface MockController {
    router: { go: (...args: unknown[]) => void };
    global: {
      main: { blockingAction: boolean };
      flags: {
        override: (flag: string, value: boolean) => Promise<void>;
        clearOverride: (flag: string) => Promise<void>;
      };
    };
    _lastRouterGo?: unknown;
    _lastFlagOverride?: { flag: string; value: boolean };
    _lastFlagClear?: string;
  }

  let mockController: MockController;

  beforeEach(() => {
    coordination.reset();
    mockController = {
      router: {
        go: (...args: unknown[]) => {
          mockController._lastRouterGo = args;
        },
      },
      global: {
        main: { blockingAction: false },
        flags: {
          override: async (flag: string, value: boolean) => {
            mockController._lastFlagOverride = { flag, value };
          },
          clearOverride: async (flag: string) => {
            mockController._lastFlagClear = flag;
          },
        },
      },
    };
  });

  function bindHost() {
    Host.bind({
      controller: mockController as unknown as AppController,
      services: {
        stateEventBus: new EventTarget(),
      } as unknown as AppServices,
    });
  }

  // ---------------------------------------------------------------------------
  // modeToggle
  // ---------------------------------------------------------------------------
  suite("modeToggle", () => {
    before(() => setDOM());
    after(() => unsetDOM());

    test("calls router.go with new mode when page is graph", async () => {
      const originalHref = window.location.href;
      window.history.replaceState({}, "", "/?flow=drive:/my-board&mode=canvas");

      try {
        bindHost();
        const evt = new StateEvent({
          eventType: "host.modetoggle",
          mode: "app" as const,
        });
        await Host.modeToggle(evt);

        assert.ok(
          mockController._lastRouterGo,
          "router.go should have been called"
        );
        assert.strictEqual(
          (mockController._lastRouterGo as unknown[])[0] &&
            (
              (mockController._lastRouterGo as unknown[])[0] as Record<
                string,
                unknown
              >
            ).mode,
          "app"
        );
      } finally {
        window.history.replaceState({}, "", originalHref);
      }
    });

    test("does not navigate when mode matches current", async () => {
      window.history.replaceState({}, "", "/?flow=drive:/my-board&mode=canvas");
      try {
        bindHost();
        const evt = new StateEvent({
          eventType: "host.modetoggle",
          mode: "canvas" as const,
        });
        await Host.modeToggle(evt);
        assert.strictEqual(
          mockController._lastRouterGo,
          undefined,
          "router.go should not be called when mode has not changed"
        );
      } finally {
        window.history.replaceState({}, "", "/");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // lock / unlock
  // ---------------------------------------------------------------------------
  suite("lock", () => {
    test("sets blockingAction to true", async () => {
      bindHost();
      assert.strictEqual(mockController.global.main.blockingAction, false);
      await Host.lock();
      assert.strictEqual(mockController.global.main.blockingAction, true);
    });
  });

  suite("unlock", () => {
    test("sets blockingAction to false", async () => {
      bindHost();
      mockController.global.main.blockingAction = true;
      await Host.unlock();
      assert.strictEqual(mockController.global.main.blockingAction, false);
    });
  });

  // ---------------------------------------------------------------------------
  // flagChange
  // ---------------------------------------------------------------------------
  suite("flagChange", () => {
    test("calls override when value is present", async () => {
      bindHost();
      const evt = new StateEvent({
        eventType: "host.flagchange",
        flag: "mcp" as const,
        value: true,
      });
      await Host.flagChange(evt);

      assert.ok(
        mockController._lastFlagOverride,
        "override should have been called"
      );
      assert.strictEqual(mockController._lastFlagOverride.flag, "mcp");
      assert.strictEqual(mockController._lastFlagOverride.value, true);
    });

    test("calls clearOverride when value is undefined", async () => {
      bindHost();
      const evt = new StateEvent({
        eventType: "host.flagchange",
        flag: "mcp" as const,
        value: undefined,
      });
      await Host.flagChange(evt);

      assert.strictEqual(
        mockController._lastFlagClear,
        "mcp",
        "clearOverride should have been called with the flag name"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // userSignIn
  // ---------------------------------------------------------------------------
  suite("userSignIn", () => {
    test("runs without error (noop)", async () => {
      bindHost();
      await Host.userSignIn();
    });
  });
});
