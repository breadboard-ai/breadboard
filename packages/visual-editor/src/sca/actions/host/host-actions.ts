/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Actions for Host events.
 *
 * Host events are UI-level events originating from the shell/host component
 * that affect global application state (mode, flags, locks, auth).
 */

import { makeAction } from "../binder.js";
import { asAction, ActionMode, stateEventTrigger } from "../../coordination.js";
import type { StateEvent } from "../../../ui/events/events.js";
import { parseUrl } from "../../../ui/utils/urls.js";

export { bind };

const bind = makeAction();

// =============================================================================
// Event-Triggered Actions
// =============================================================================

/**
 * Toggles the editor mode (canvas/split).
 *
 * **Triggers:** `host.modetoggle` StateEvent
 */
export const modeToggle = asAction(
  "Host.modeToggle",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Host Mode Toggle",
        services.stateEventBus,
        "host.modetoggle"
      );
    },
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;
    const detail = (evt as StateEvent<"host.modetoggle">).detail;
    const current = parseUrl(window.location.href);
    if (current.page === "graph") {
      const newMode = detail.mode;
      if (newMode !== current.mode) {
        controller.router.go({ ...current, mode: newMode });
      }
    }
  }
);

/**
 * Sets the blocking action flag to true.
 *
 * **Triggers:** `host.lock` StateEvent
 */
export const lock = asAction(
  "Host.lock",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Host Lock",
        services.stateEventBus,
        "host.lock"
      );
    },
  },
  async (): Promise<void> => {
    const { controller } = bind;
    controller.global.main.blockingAction = true;
  }
);

/**
 * Sets the blocking action flag to false.
 *
 * **Triggers:** `host.unlock` StateEvent
 */
export const unlock = asAction(
  "Host.unlock",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Host Unlock",
        services.stateEventBus,
        "host.unlock"
      );
    },
  },
  async (): Promise<void> => {
    const { controller } = bind;
    controller.global.main.blockingAction = false;
  }
);

/**
 * Overrides or clears a runtime flag.
 *
 * **Triggers:** `host.flagchange` StateEvent
 */
export const flagChange = asAction(
  "Host.flagChange",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Host Flag Change",
        services.stateEventBus,
        "host.flagchange"
      );
    },
  },
  async (evt?: Event): Promise<void> => {
    const { controller } = bind;
    const detail = (evt as StateEvent<"host.flagchange">).detail;
    if (typeof detail.value !== "undefined") {
      await controller.global.flags.override(detail.flag, detail.value);
    } else {
      await controller.global.flags.clearOverride(detail.flag);
    }
  }
);

/**
 * User sign-in event. Noop for main routing (only handled in Lite mode).
 *
 * **Triggers:** `host.usersignin` StateEvent
 */
export const userSignIn = asAction(
  "Host.userSignIn",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => {
      const { services } = bind;
      return stateEventTrigger(
        "Host User Sign In",
        services.stateEventBus,
        "host.usersignin"
      );
    },
  },
  async (): Promise<void> => {
    // Noop for main routing. This event is only handled in Lite mode.
  }
);
