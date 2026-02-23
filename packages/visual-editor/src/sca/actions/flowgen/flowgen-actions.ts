/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, GraphTheme, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { makeAction, withUIBlocking, stopRun } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import { onFlowgenGenerate as onFlowgenGenerateTrigger } from "./triggers.js";
import type {
  FlowGenerator,
  OneShotFlowGenFailureResponse,
  OneShotFlowGenResponse,
} from "../../../ui/flow-gen/flow-generator.js";
import { generateImage, persistTheme } from "../theme/theme-utils.js";
import { getThemeFromIntentGenerationPrompt } from "../../../ui/prompts/theme-generation.js";
import type { StateEvent } from "../../../ui/events/events.js";
import type { AppController } from "../../controller/controller.js";
import type { AppServices } from "../../services/services.js";

export const bind = makeAction();

export type GenerateResult =
  | { success: true }
  | { success: false; error: unknown; suggestedIntent?: string };

/**
 * Core flowgen logic: generates a flow from user intent using FlowGen.
 *
 * This action only contains core generation logic. Orchestration
 * (board locking, run stop, action tracking, and runner re-preparation)
 * is handled by `onFlowgenGenerate`.
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

// =============================================================================
// Event-Triggered Actions
// =============================================================================

/**
 * Orchestrates a full flow generation cycle in response to a
 * `flowgen.generate` StateEvent.
 *
 * Steps:
 * 1. Lock the board (blockingAction = true)
 * 2. Stop any active run
 * 3. Set flowgen status to "generating"
 * 4. Track the action for analytics
 * 5. Invoke core generate logic
 * 6. Unlock the board
 *
 * Runner re-preparation happens automatically after generation because
 * the graph replacement triggers `onTopologyChange`, which fires
 * `Run.prepare`.
 *
 * **Triggers:** `flowgen.generate` StateEvent
 */
export const onFlowgenGenerate = asAction(
  "Flowgen.onFlowgenGenerate",
  {
    mode: ActionMode.Exclusive,
    triggeredBy: () => onFlowgenGenerateTrigger(bind),
  },
  async (evt?: StateEvent<"flowgen.generate">): Promise<void> => {
    const { controller, services } = bind;
    const { intent } = evt!.detail;

    const url = controller.editor.graph.url;

    // Stop any active run before generating.
    stopRun(controller);

    // Set generating status.
    controller.global.flowgenInput.state = { status: "generating" };

    // Analytics tracking.
    services.actionTracker.flowGenEdit(url ?? "");

    await withUIBlocking(controller, async () => {
      await generate(intent);
    });
  }
);
