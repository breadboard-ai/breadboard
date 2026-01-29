/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Project } from "../../../ui/state/types.js";
import { makeAction } from "../binder.js";
import { flowGenWithTheme } from "../../../ui/flow-gen/flowgen-with-theme.js";
import * as Graph from "../graph/graph-actions.js";

export const bind = makeAction();

export type GenerateResult =
  | { success: true }
  | { success: false; error: unknown; suggestedIntent?: string };

/**
 * Generates a flow from a user intent using FlowGen.
 *
 * @param intent - The user's description/intent for the flow
 * @param projectState - The project state for theme generation (from Lit context)
 */
export async function generate(
  intent: string,
  projectState: Project
): Promise<GenerateResult> {
  const currentGraph = bind.controller.editor.graph.editor?.raw();
  if (!currentGraph) {
    return { success: false, error: "No active graph to edit" };
  }

  const { controller, services } = bind;
  const flowgenInput = controller.global.flowgenInput;

  // Lock UI and stop any running execution
  controller.global.main.blockingAction = true;
  controller.run.main.stop();
  flowgenInput.setState({ status: "generating" });

  // Track analytics
  services.actionTracker?.flowGenEdit(currentGraph.url);

  try {
    const response = await flowGenWithTheme(
      services.flowGenerator,
      intent,
      currentGraph,
      projectState
    );

    if ("error" in response) {
      flowgenInput.setState({
        status: "error",
        error: response.error,
        suggestedIntent: response.suggestedIntent,
      });
      return {
        success: false,
        error: response.error,
        suggestedIntent: response.suggestedIntent,
      };
    }

    const { flow, theme } = response;

    // Replace graph with full theme handling (centralized in graph action)
    await Graph.replaceWithTheme({
      replacement: flow,
      theme,
      creator: { role: "assistant" },
    });

    flowgenInput.clear();
    return { success: true };
  } finally {
    controller.global.main.blockingAction = false;
  }
}
