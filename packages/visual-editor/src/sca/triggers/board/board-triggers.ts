/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeTrigger } from "../binder.js";

export const bind = makeTrigger();

/**
 * Trigger that saves the graph when the version changes.
 *
 * @param deps The dependencies for the trigger.
 * @returns The trigger.
 */
export function registerSaveTrigger() {
  bind.register("Save Trigger", () => {
    const { controller, actions } = bind;
    const { version, readOnly, editor } = controller.editor.graph;
    if (readOnly || version === -1 || !editor) {
      return;
    }

    actions.board.save();
  });
}
