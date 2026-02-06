/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Project } from "../../../ui/state/types.js";
import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { flowGenWithTheme } from "../../../ui/flow-gen/flowgen-with-theme.js";

export const bind = makeAction();

export type GenerateResult =
  | { success: true }
  | { success: false; error: unknown; suggestedIntent?: string };

/**
 * Core flowgen logic: generates a flow from user intent using FlowGen.
 *
 * NOTE: Board locking, status updates, and action tracking are handled
 * by the event-router (flowgen.generate). This action only contains core logic.
 *
 * @param intent - The user's description/intent for the flow
 * @param projectState - The project state for theme generation (from Lit context)
 *
 * TODO: projectState parameter is a temporary workaround. Project is in the
 * process of being removed; this will need to be refactored once that happens.
 */
export const generate = asAction(
  "Flowgen.generate",
  { mode: ActionMode.Immediate },
  async (intent: string, projectState: Project): Promise<GenerateResult> => {
    const { controller, services } = bind;

    const currentGraph = controller.editor.graph.editor?.raw();
    if (!currentGraph) {
      return { success: false, error: "No active graph to edit" };
    }

    const flowgenInput = controller.global.flowgenInput;

    try {
      const response = await flowGenWithTheme(
        services.flowGenerator,
        intent,
        currentGraph,
        projectState
      );

      if ("error" in response) {
        flowgenInput.state = {
          status: "error",
          error: response.error,
          suggestedIntent: response.suggestedIntent,
        };
        return {
          success: false,
          error: response.error,
          suggestedIntent: response.suggestedIntent,
        };
      }

      const { flow, theme } = response;

      // Set pending graph replacement - the Graph.replaceWithTheme action
      // will react to this signal and perform the actual replacement
      controller.editor.graph.pendingGraphReplacement = {
        replacement: flow,
        theme,
        creator: { role: "assistant" },
      };

      flowgenInput.clear();
      return { success: true };
    } catch (error) {
      flowgenInput.state = {
        status: "error",
        error,
      };
      return { success: false, error };
    }
  }
);
