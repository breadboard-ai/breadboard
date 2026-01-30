/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { ConsentController } from "./consent-controller.js";
export { DebugController } from "./debug-controller.js";
export { FeedbackController } from "./feedback-controller.js";
export { SnackbarController } from "./snackbar-controller.js";
export { StatusUpdatesController } from "./status-updates-controller.js";
export { ToastController } from "./toast-controller.js";
export { FlagController } from "./flag-controller.js";

import {
  SubscriptionStatus,
  UILoadState,
  UIOverlays,
} from "../../../../ui/state/types.js";
import { VisualEditorMode } from "../../../../ui/types/types.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

export class GlobalController extends RootController {
  @field({ persist: "local" })
  accessor experimentalComponents = false;

  @field()
  accessor mode: VisualEditorMode = "canvas";

  @field({ persist: "local" })
  accessor boardServer = "Browser Storage";

  @field({ persist: "local" })
  accessor boardLocation = "Browser Storage";

  /**
   * Indicates whether or not the UI can currently run a flow or not.
   * This is useful in situations where we're doing some work on the
   * board and want to prevent the user from triggering the start
   * of the flow.
   */
  @field()
  accessor canRunMain = true;

  /**
   * Indicates that the UI is currently undertaking an action and that the user
   * should be prevented from interacting while that takes place.
   */
  @field()
  accessor blockingAction = false;

  @field()
  accessor loadState: UILoadState = "Home";

  @field()
  accessor subscriptionStatus: SubscriptionStatus = "indeterminate";

  @field()
  accessor subscriptionCredits: number = -1;

  @field({ deep: true })
  accessor show = new Set<UIOverlays>();
}
