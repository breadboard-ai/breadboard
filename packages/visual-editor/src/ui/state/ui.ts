/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { VisualEditorMode } from "../types/types.js";
import { SignalSet } from "signal-utils/set";
import { SignalArray } from "signal-utils/array";
import { UI, UIOverlays, UILoadState, SubscriptionStatus } from "./types.js";
import { ConsentRequestWithCallback } from "@breadboard-ai/types";

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
  accessor editorSection: "preview" | "console" = "preview";

  @signal
  accessor showStatusUpdateChip = null;

  @signal
  accessor lastSnackbarDetailsInfo = null;

  @signal
  accessor subscriptionStatus: SubscriptionStatus = "indeterminate";

  @signal
  accessor subscriptionCredits: number = -1;

  accessor show = new SignalSet<UIOverlays>();

  /**
   * Consent requests that will be displayed as a modal popup
   */
  accessor consentRequests = new SignalArray<ConsentRequestWithCallback>();
}
