/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, GraphTheme, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import type {
  FlowGenerator,
  OneShotFlowGenFailureResponse,
  OneShotFlowGenResponse,
} from "../../../ui/flow-gen/flow-generator.js";
import { generateImage, persistTheme } from "../theme/theme-utils.js";
import { getThemeFromIntentGenerationPrompt } from "../../../ui/prompts/theme-generation.js";
import type { AppController } from "../../controller/controller.js";
import type { AppServices } from "../../services/services.js";

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
 */
export const generate = asAction(
  "Flowgen.generate",
  { mode: ActionMode.Immediate },
  async (intent: string): Promise<GenerateResult> => {
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
        controller,
        services
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

      // NOTE: Don't clear flowgenInput here — the Graph.replaceWithTheme
      // trigger fires asynchronously to apply the replacement. Clearing now
      // would reset isGenerating to false while the graph is still empty,
      // causing a flash to the "home" view. The clear happens in
      // replaceWithTheme after the graph is actually replaced.
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

/**
 * Encapsulates invoking flowgen with theme generation.
 * Runs flow generation and theme generation in parallel,
 * aborting theme generation early if flowgen fails.
 */
async function flowGenWithTheme(
  flowGenerator: FlowGenerator,
  intent: string,
  currentGraph: GraphDescriptor,
  controller: AppController,
  services: AppServices
): Promise<
  OneShotFlowGenFailureResponse | { flow: GraphDescriptor; theme?: GraphTheme }
> {
  const abortController = new AbortController();

  type GenResponse = [
    flowgen: PromiseSettledResult<OneShotFlowGenResponse>,
    theme: PromiseSettledResult<Outcome<GraphTheme>>,
  ];

  let eject: (response: OneShotFlowGenResponse) => void;
  const ejectSignal = new Promise<GenResponse>((resolve) => {
    eject = (response: OneShotFlowGenResponse) => {
      abortController.abort();
      resolve([
        { status: "fulfilled", value: response },
        {
          status: "rejected",
          reason: "Theme generation aborted due to flowgen failure",
        },
      ]);
    };
  });

  const generating = flowGenerator
    .oneShot({
      intent,
      context: { flow: currentGraph },
    })
    .then((response) => {
      if ("error" in response) {
        eject?.(response);
      }
      return response;
    });

  const newGraph = (currentGraph?.nodes.length || 0) === 0;
  const creatingTheme = newGraph
    ? generateThemeFromIntent(
        intent,
        abortController.signal,
        controller,
        services
      )
    : Promise.resolve(err(`Existing graph, skipping theme generation`));

  const [generated, createdTheme] = await Promise.race([
    Promise.allSettled([generating, creatingTheme]),
    ejectSignal,
  ]);

  if (generated.status === "rejected") {
    return { error: generated.reason };
  }
  const result = generated.value;
  if ("error" in result) {
    return result;
  }
  let theme;
  if (createdTheme.status === "fulfilled" && ok(createdTheme.value)) {
    theme = createdTheme.value;
  }
  return { flow: result.flow, theme };
}

/**
 * Generates a theme from an intent string using shared utilities.
 * This is a local helper — NOT an action call — avoiding action-to-action
 * coupling.
 */
async function generateThemeFromIntent(
  intent: string,
  abortSignal: AbortSignal,
  controller: AppController,
  services: AppServices
): Promise<Outcome<GraphTheme>> {
  const appTheme = await generateImage(
    getThemeFromIntentGenerationPrompt(intent),
    abortSignal,
    controller,
    services
  );
  if (!ok(appTheme)) return appTheme;
  return persistTheme(appTheme, controller, services);
}
