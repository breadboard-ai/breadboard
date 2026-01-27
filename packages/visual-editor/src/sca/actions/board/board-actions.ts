/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Utils } from "../../utils.js";
import { makeAction } from "../binder.js";

export const bind = makeAction();

/**
 * @fileoverview
 *
 * Contains Actions for loading and saving graphs.
 *
 * Note: Currently these Actions does not require the graphStore service because
 * we keep the editor instance on the graphController. This is so that it is a
 * stable reference on which we can listen to legacy events. However, the aim is
 * to remove events in favor of Signals, which, when complete, will mean that
 * edits can get a fresh editor from the graphStore service here.
 *
 *
 */

/**
 * Saves a board.
 */
export async function save() {
  const { controller } = bind;
  const logger = Utils.Logging.getLogger(controller);

  // TODO: Implement the behavior.

  logger.log(
    Utils.Logging.Formatter.info(
      "Version change:",
      controller.editor.graph.version
    ),
    "Trigger: Save"
  );
}
