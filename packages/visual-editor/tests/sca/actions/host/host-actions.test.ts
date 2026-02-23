/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import {
  suite,
  test,
  beforeEach,
  afterEach,
  before,
  after,
  mock,
} from "node:test";
import * as Host from "../../../../src/sca/actions/host/host-actions.js";
import { coordination } from "../../../../src/sca/coordination.js";
import type { AppController } from "../../../../src/sca/controller/controller.js";
import type { AppServices } from "../../../../src/sca/services/services.js";
import { StateEvent } from "../../../../src/ui/events/events.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { createMockEnvironment } from "../../helpers/mock-environment.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";

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
      env: createMockEnvironment(defaultRuntimeFlags),
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
        const evt = new StateEvent<"host.modetoggle">({
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
        const evt = new StateEvent<"host.modetoggle">({
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
      const overrideFn = mock.fn();
      const env = createMockEnvironment(defaultRuntimeFlags);
      Host.bind({
        controller: mockController as unknown as AppController,
        services: {
          stateEventBus: new EventTarget(),
        } as unknown as AppServices,
        env: {
          ...env,
          flags: {
            ...env.flags,
            override: overrideFn,
          } as never,
        },
      });

      const evt = new StateEvent<"host.flagchange">({
        eventType: "host.flagchange",
        flag: "mcp" as const,
        value: true,
      });
      await Host.flagChange(evt);

      assert.strictEqual(
        overrideFn.mock.callCount(),
        1,
        "override should have been called once"
      );
      assert.strictEqual(overrideFn.mock.calls[0].arguments[0], "mcp");
      assert.strictEqual(overrideFn.mock.calls[0].arguments[1], true);
    });

    test("calls clearOverride when value is undefined", async () => {
      const clearOverrideFn = mock.fn();
      const env = createMockEnvironment(defaultRuntimeFlags);
      Host.bind({
        controller: mockController as unknown as AppController,
        services: {
          stateEventBus: new EventTarget(),
        } as unknown as AppServices,
        env: {
          ...env,
          flags: {
            ...env.flags,
            clearOverride: clearOverrideFn,
          } as never,
        },
      });

      const evt = new StateEvent<"host.flagchange">({
        eventType: "host.flagchange",
        flag: "mcp" as const,
        value: undefined,
      });
      await Host.flagChange(evt);

      assert.strictEqual(
        clearOverrideFn.mock.callCount(),
        1,
        "clearOverride should have been called once"
      );
      assert.strictEqual(clearOverrideFn.mock.calls[0].arguments[0], "mcp");
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

// =============================================================================
// Host Actions — Keyboard
// =============================================================================

suite("Host Actions — Keyboard", () => {
  before(() => setDOM());
  after(() => unsetDOM());

  beforeEach(() => {
    coordination.reset();
  });

  interface KeyboardMockController {
    global: {
      main: { blockingAction: boolean; experimentalComponents: boolean };
      debug: { enabled: boolean };
      toasts: { toast: (...args: unknown[]) => string };
    };
    _toastCalls: unknown[][];
  }

  function makeKeyboardController(): KeyboardMockController {
    const ctrl: KeyboardMockController = {
      global: {
        main: {
          blockingAction: false,
          experimentalComponents: false,
        },
        debug: { enabled: false },
        toasts: {
          toast: (...args: unknown[]) => {
            ctrl._toastCalls.push(args);
            return "toast-id";
          },
        },
      },
      _toastCalls: [],
    };
    return ctrl;
  }

  function bindKeyboard(
    controller: KeyboardMockController,
    services?: Partial<AppServices>
  ) {
    Host.bind({
      controller: controller as unknown as AppController,
      services: {
        stateEventBus: new EventTarget(),
        ...services,
      } as unknown as AppServices,
      env: createMockEnvironment(defaultRuntimeFlags),
    });
  }

  // ---------------------------------------------------------------------------
  // onToggleExperimentalComponents
  // ---------------------------------------------------------------------------
  suite("onToggleExperimentalComponents", () => {
    test("toggles experimentalComponents from false to true", async () => {
      const ctrl = makeKeyboardController();
      ctrl.global.main.experimentalComponents = false;
      bindKeyboard(ctrl);

      await Host.onToggleExperimentalComponents();

      assert.strictEqual(ctrl.global.main.experimentalComponents, true);
    });

    test("toggles experimentalComponents from true to false", async () => {
      const ctrl = makeKeyboardController();
      ctrl.global.main.experimentalComponents = true;
      bindKeyboard(ctrl);

      await Host.onToggleExperimentalComponents();

      assert.strictEqual(ctrl.global.main.experimentalComponents, false);
    });

    test("clears blockingAction after completion", async () => {
      const ctrl = makeKeyboardController();
      bindKeyboard(ctrl);

      await Host.onToggleExperimentalComponents();

      assert.strictEqual(
        ctrl.global.main.blockingAction,
        false,
        "blockingAction should be cleared"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // onToggleDebug
  // ---------------------------------------------------------------------------
  suite("onToggleDebug", () => {
    test("toggles debug.enabled from false to true", async () => {
      const ctrl = makeKeyboardController();
      ctrl.global.debug.enabled = false;
      bindKeyboard(ctrl);

      await Host.onToggleDebug();

      assert.strictEqual(ctrl.global.debug.enabled, true);
    });

    test("toggles debug.enabled from true to false", async () => {
      const ctrl = makeKeyboardController();
      ctrl.global.debug.enabled = true;
      bindKeyboard(ctrl);

      await Host.onToggleDebug();

      assert.strictEqual(ctrl.global.debug.enabled, false);
    });
  });

  // ---------------------------------------------------------------------------
  // onDownloadAgentTraces
  // ---------------------------------------------------------------------------
  suite("onDownloadAgentTraces", () => {
    afterEach(() => {
      mock.restoreAll();
    });

    test("creates download link when traces exist", async () => {
      const ctrl = makeKeyboardController();
      let clickedHref = "";

      bindKeyboard(ctrl, {
        agentContext: {
          exportTraces: () => [{ trace: "data" }],
        },
      } as unknown as Partial<AppServices>);

      const created: HTMLAnchorElement[] = [];
      const originalCreate = document.createElement.bind(document);
      mock.method(document, "createElement", (tag: string) => {
        const el = originalCreate(tag);
        if (tag === "a") {
          created.push(el as HTMLAnchorElement);
          (el as HTMLAnchorElement).click = () => {
            clickedHref = (el as HTMLAnchorElement).href;
          };
        }
        return el;
      });

      await Host.onDownloadAgentTraces();

      assert.ok(created.length > 0, "Should create an anchor element");
      assert.ok(
        created[0].download.startsWith("agent-traces-"),
        "Download filename should start with 'agent-traces-'"
      );
      assert.ok(clickedHref.length > 0, "Anchor should be clicked");
    });

    test("does nothing when traces are empty", async () => {
      const ctrl = makeKeyboardController();

      bindKeyboard(ctrl, {
        agentContext: {
          exportTraces: () => [],
        },
      } as unknown as Partial<AppServices>);

      let anchorCreated = false;
      const originalCreate = document.createElement.bind(document);
      mock.method(document, "createElement", (tag: string) => {
        const el = originalCreate(tag);
        if (tag === "a") anchorCreated = true;
        return el;
      });

      await Host.onDownloadAgentTraces();

      assert.strictEqual(
        anchorCreated,
        false,
        "Should not create anchor when no traces"
      );
    });
  });
});
