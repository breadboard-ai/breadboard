/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, GraphTheme, Outcome } from "@breadboard-ai/types";
import {
  FlowGenerator,
  OneShotFlowGenFailureResponse,
  OneShotFlowGenResponse,
} from "./flow-generator.js";
import { Project } from "../state/index.js";
import { err, ok } from "@breadboard-ai/utils";

export { flowGenWithTheme };

/**
 * Encapsulates invoking flowgen with theme generation.
 */
async function flowGenWithTheme(
  flowGenerator: FlowGenerator,
  intent: string,
  currentGraph: GraphDescriptor,
  projectState: Project
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
    ? projectState.themes.generateThemeFromIntent(
        intent,
        abortController.signal
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
