/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Utils from "../../utils/utils.js";
import { ToastType } from "../../../ui/events/events.js";
import { makeAction } from "../binder.js";

export const bind = makeAction();

export async function deleteCurrentSelection() {
  const { controller } = bind;

  const size = controller.editor.selection.size;

  if (size === 0) {
    controller.global.toasts.toast("Nothing selected", ToastType.WARNING);
    return;
  }

  try {
    // TODO
  } catch (err) {
    const logger = Utils.Logging.getLogger(controller);
    logger.log(
      Utils.Logging.Formatter.error("Failed to delete selection", err),
      "deleteCurrentSelection"
    );
    controller.global.toasts.toast("Could not delete items", ToastType.ERROR);
  }
}
