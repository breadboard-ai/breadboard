/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BoardServer, GraphDescriptor } from "@breadboard-ai/types";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import type { AppScreenPresenter } from "../presenters/app-screen-presenter.js";
import { DAYS, maybeTriggerSurvey, type SurveyConfig } from "./survey.js";

const CONFIG: SurveyConfig = {
  name: "nlToOpalSatisfaction1",
  triggerId:
    CLIENT_DEPLOYMENT_CONFIG.SURVEY_NL_TO_OPAL_SATISFACTION_1_TRIGGER_ID ?? "",
  stickyUserProbability: 1 / 10,
  eventProbability: 1 / 3,
  minimumDurationBetweenSurveys: 90 * DAYS,
};

const WAIT_MS = 20_000;

/**
 * Minimal interface for the graph controller properties the survey needs.
 */
interface SurveyGraphSource {
  readonly finalOutputValues: unknown;
}

let globalState:
  | { status: "inactive" }
  | { status: "waiting"; presenter: AppScreenPresenter }
  | { status: "triggering" } = { status: "inactive" };

export async function maybeTriggerNlToOpalSatisfactionSurvey(
  presenter: AppScreenPresenter,
  graphSource: SurveyGraphSource,
  graph: GraphDescriptor,
  boardServer: BoardServer
) {
  if (
    !CONFIG.triggerId ||
    !graph.url ||
    globalState.status === "triggering" ||
    (globalState.status === "waiting" && presenter === globalState.presenter)
  ) {
    return;
  }

  const url = new URL(graph.url);
  const eligible =
    // We're viewing the final screen
    presenter.state === "output" &&
    graphSource.finalOutputValues &&
    // ... and the graph was created by the current user during this session
    boardServer.isMine?.(url) &&
    boardServer.createdDuringThisSession?.(url) &&
    // ... using natural language
    graph.metadata?.raw_intent;

  if (!eligible) {
    return;
  }

  const pageUrlBeforeWaiting = document.location.href;
  globalState = { status: "waiting", presenter };
  await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
  const superceded =
    globalState.status !== "waiting" || globalState.presenter !== presenter;
  const navigatedAway = pageUrlBeforeWaiting !== document.location.href;
  if (superceded || navigatedAway) {
    return;
  }

  globalState = { status: "triggering" };
  await maybeTriggerSurvey(CONFIG);
  globalState = { status: "inactive" };
}
