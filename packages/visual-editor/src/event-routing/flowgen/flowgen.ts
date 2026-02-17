/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Flowgen event route. Delegates core generation to SCA, then prepares
 * a fresh runner so the step list populates from the new graph.
 */

import { EventRoute } from "../types.js";

export const GenerateRoute: EventRoute<"flowgen.generate"> = {
  event: "flowgen.generate",

  async do({ originalEvent, sca, actionTracker }) {
    const { intent } = originalEvent.detail;
    const currentGraph = sca.controller.editor.graph.editor?.raw();
    if (!currentGraph) {
      console.warn("Unable to generate: no active graph");
      return false;
    }

    // Board locking and action tracking stay in event-router (migration pattern)
    sca.controller.global.main.blockingAction = true;
    sca.actions.run.stop();
    sca.controller.global.flowgenInput.state = { status: "generating" };
    actionTracker?.flowGenEdit(currentGraph.url);

    try {
      // Delegate core logic to SCA action
      await sca.actions.flowgen.generate(intent);
    } finally {
      sca.controller.global.main.blockingAction = false;
    }

    // Prepare a fresh runner so the step list populates from the new graph.
    sca.actions.run.prepare();

    return true;
  },
};
