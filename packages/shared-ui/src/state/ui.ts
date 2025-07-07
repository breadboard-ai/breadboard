/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { VisualEditorMode } from "../types/types";
import { SignalSet } from "signal-utils/set";
import { SignalMap } from "signal-utils/map";
import { ToastType } from "../events/events";
import { UI, UIOverlays, UILoadState } from "./types";

export { createUIState };

function createUIState(): UI {
  return new ReactiveUIState();
}

class ReactiveUIState implements UI {
  @signal
  accessor mode: VisualEditorMode = "canvas";

  @signal
  accessor boardServer = "Browser Storage";

  @signal
  accessor boardLocation = "Browser Storage";

  /**
   * Indicates whether or not the UI can currently run a flow or not.
   * This is useful in situations where we're doing some work on the
   * board and want to prevent the user from triggering the start
   * of the flow.
   */
  @signal
  accessor canRunMain = true;

  /**
   * Indicates that the UI is currently undertaking an action and that the user
   * should be prevented from interacting while that takes place.
   */
  @signal
  accessor blockingAction = false;

  @signal
  accessor loadState: UILoadState = "Home";

  @signal
  accessor projectFilter: string | null = null;

  accessor show = new SignalSet<UIOverlays>();

  accessor toasts = new SignalMap<
    string,
    {
      message: string;
      type: ToastType;
      persistent: boolean;
    }
  >();
}
