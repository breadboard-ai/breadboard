/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppController } from "../../controller/controller.js";
import * as Utils from "../../utils/utils.js";
import { ToastType } from "../../../ui/events/events.js";

export async function deleteCurrentSelection(app: AppController) {
  const size = app.editor.selection.size;

  if (size === 0) {
    app.global.toasts.toast("Nothing selected", ToastType.WARNING);
    return;
  }

  try {
    // TODO
  } catch (err) {
    const logger = Utils.Logging.getLogger(app);
    logger.log(
      Utils.Logging.Formatter.error("Failed to delete selection", err),
      "deleteCurrentSelection"
    );
    app.global.toasts.toast("Could not delete items", ToastType.ERROR);
  }
}
