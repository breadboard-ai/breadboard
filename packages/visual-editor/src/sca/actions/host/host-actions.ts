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

import { makeAction, withUIBlocking } from "../binder.js";
import { asAction, ActionMode, keyboardTrigger } from "../../coordination.js";
import {
  onModeToggle,
  onLock,
  onUnlock,
  onFlagChange,
  onUserSignIn,
} from "./triggers.js";
import type { StateEvent } from "../../../ui/events/events.js";
import { ToastType } from "../../types.js";
import { parseUrl } from "../../../ui/navigation/urls.js";

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
    triggeredBy: () => onModeToggle(bind),
  },
  async (evt?: StateEvent<"host.modetoggle">): Promise<void> => {
    const { controller } = bind;
    const detail = evt!.detail;
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
    triggeredBy: () => onLock(bind),
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
    triggeredBy: () => onUnlock(bind),
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
    triggeredBy: () => onFlagChange(bind),
  },
  async (evt?: StateEvent<"host.flagchange">): Promise<void> => {
    const { env } = bind;
    const detail = evt!.detail;
    if (typeof detail.value !== "undefined") {
      await env.flags.override(detail.flag, detail.value);
    } else {
      await env.flags.clearOverride(detail.flag);
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
    triggeredBy: () => onUserSignIn(bind),
  },
  async (): Promise<void> => {
    // Noop for main routing. This event is only handled in Lite mode.
  }
);

// =============================================================================
// Keyboard-triggered Actions
// =============================================================================

/**
 * Toggle experimental components on/off.
 *
 * **Triggers:** `Cmd+Shift+e` / `Ctrl+Shift+e`
 */
export const onToggleExperimentalComponents = asAction(
  "Host.onToggleExperimentalComponents",
  {
    mode: ActionMode.Awaits,
    triggeredBy: () =>
      keyboardTrigger("Toggle Experimental Components", [
        "Cmd+Shift+e",
        "Ctrl+Shift+e",
      ]),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    await withUIBlocking(
      controller,
      async () => {
        controller.global.main.experimentalComponents =
          !controller.global.main.experimentalComponents;
      },
      {
        alwaysNotify: true,
        complete: `Experimental Components ${controller.global.main.experimentalComponents ? "Enabled" : "Disabled"}`,
        completeType: ToastType.INFORMATION,
      }
    );
  }
);

/**
 * Toggle debug mode on/off.
 *
 * **Triggers:** `Cmd+Shift+d` / `Ctrl+Shift+d`
 */
export const onToggleDebug = asAction(
  "Host.onToggleDebug",
  {
    mode: ActionMode.Awaits,
    triggeredBy: () =>
      keyboardTrigger("Toggle Debug", ["Cmd+Shift+d", "Ctrl+Shift+d"]),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    await withUIBlocking(
      controller,
      async () => {
        controller.global.debug.enabled = !controller.global.debug.enabled;
      },
      {
        alwaysNotify: true,
        complete: `Debug ${controller.global.debug.enabled ? "Enabled" : "Disabled"}`,
        completeType: ToastType.INFORMATION,
      }
    );
  }
);

/**
 * Download agent traces as a JSON file.
 *
 * **Triggers:** `Cmd+Shift+x` / `Ctrl+Shift+x`
 */
export const onDownloadAgentTraces = asAction(
  "Host.onDownloadAgentTraces",
  {
    mode: ActionMode.Awaits,
    triggeredBy: () =>
      keyboardTrigger("Download Agent Traces", ["Cmd+Shift+x", "Ctrl+Shift+x"]),
  },
  async (): Promise<void> => {
    const { controller, services } = bind;
    await withUIBlocking(
      controller,
      async () => {
        const traces = services.agentContext.exportTraces();
        if (traces.length === 0) {
          return;
        }
        const blob = new Blob([JSON.stringify(traces, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        a.download = `agent-traces-${timestamp}.log.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      {
        alwaysNotify: true,
        pending: "Downloading agent traces...",
        complete: "Agent traces downloaded",
        completeType: ToastType.INFORMATION,
      }
    );
  }
);
