/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeTrigger } from "../binder.js";
import * as NodeActions from "../../actions/node/node-actions.js";

export const bind = makeTrigger();

/**
 * Trigger that automatically generates names for nodes when their
 * configuration changes. Reacts to the `lastNodeConfigChange` signal.
 *
 * This is a thin trigger that delegates to the autoname action.
 */
export function registerAutonameTrigger() {
  bind.register("Autoname Trigger", async () => {
    const { controller } = bind;
    const { lastNodeConfigChange } = controller.editor.graph;

    // Guard: only trigger when there's a config change to process
    if (!lastNodeConfigChange) {
      return;
    }

    const { nodeId, graphId, configuration, titleUserModified } =
      lastNodeConfigChange;

    // Delegate to action
    await NodeActions.autoname({
      nodeId,
      graphId,
      configuration,
      titleUserModified,
    });
  });
}
