/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type DBSchema, openDB } from "idb";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import { loadExternalSurveyLibOnce } from "./survey-lib.js";
import { parseUrl } from "../navigation/urls.js";

const { SURVEY_API_KEY } = CLIENT_DEPLOYMENT_CONFIG;

const FORCE_SURVEY_SELECTION =
  parseUrl(document.location.href).dev?.forceSurveySelection === "true";

const SURVEY_MODE = FORCE_SURVEY_SELECTION
  ? "test"
  : CLIENT_DEPLOYMENT_CONFIG.SURVEY_MODE || "off";

const SURVEY_DB_NAME = "survey";
const SURVEY_STORE_NAME = "survey";

export const DAYS = 24 * 60 * 60 * 1000;

export type SurveyConfig = {
  /**
   * Our local name used for storing state in IndexedDB.
   */
  name: string;

  /**
   * A unique identifier generated when configuring a survey in the external
   * survey service.
   */
  triggerId: string;

  /**
   * The sticky probability [0,1] that this survey will *ever* trigger for the
   * current user, **on this particular device & browser**.
   *
   * This is "sticky" in the sense that the weighted coin flip is performed only
   * once, and the outcome is persisted in IndexedDB.
   */
  stickyUserProbability: number;

  /**
   * The probability [0,1] the survey will trigger for each specific
   * opportunity.
   */
  eventProbability: number;

  /**
   * If the user has already taken this survey, then this is the minimum number
   * of milliseconds that must have elapsed before they can be shown the survey
   * again. To never show a survey twice, set to `Infinity`.
   */
  minimumDurationBetweenSurveys: number;
};

export async function maybeTriggerSurvey(survey: SurveyConfig) {
  if (await shouldTriggerSurvey(survey)) {
    await triggerSurvey(survey);
  }
}

async function shouldTriggerSurvey(survey: SurveyConfig): Promise<boolean> {
  if (!SURVEY_API_KEY) {
    return false;
  }

  if (FORCE_SURVEY_SELECTION && SURVEY_MODE === "test") {
    console.info(
      `[survey] Forcing survey selection ${JSON.stringify(survey.name)}`
    );
    return true;
  }

  const db = await openSurveysDB();
  const tx = db.transaction([SURVEY_STORE_NAME], "readwrite");
  const store = tx.objectStore(SURVEY_STORE_NAME);

  let record = await store.get(survey.name);
  let recordModified = false;
  if (!record) {
    record = {
      selected: flipWeightedCoin(survey.stickyUserProbability),
    };
    recordModified = true;
    if (record.selected) {
      console.info(
        `[survey] User selected for survey ${JSON.stringify(survey.name)}`
      );
    } else {
      console.info(
        `[survey] User NOT selected for survey ${JSON.stringify(survey.name)}`
      );
    }
  }

  const eventSelected =
    record.selected &&
    (!record.lastSurveyTime ||
      Date.now() - record.lastSurveyTime >=
        survey.minimumDurationBetweenSurveys) &&
    flipWeightedCoin(survey.eventProbability);

  if (eventSelected) {
    record.lastSurveyTime = Date.now();
    recordModified = true;
  }

  if (recordModified) {
    store.put(record, survey.name);
    tx.commit();
    await tx.done;
  }
  db.close();

  return eventSelected;
}

function flipWeightedCoin(probability: number): boolean {
  return Math.random() < probability;
}

async function triggerSurvey({ name, triggerId }: SurveyConfig) {
  console.info(`[survey] Triggering survey ${JSON.stringify(name)}`);
  const surveyLib = await loadExternalSurveyLibOnce();
  const surveyData = await new Promise((resolve) =>
    surveyLib.requestSurvey({
      triggerId,
      enableTestingMode: SURVEY_MODE === "test",
      thirdPartyDomainSupportEnabled: true,
      callback: ({ surveyData, surveyError }) => {
        {
          if (surveyError) {
            console.error(`[survey] Survey API error`, surveyError);
          }
          resolve(surveyData);
        }
      },
    })
  );
  if (surveyData) {
    surveyLib.presentSurvey({
      surveyData,
      customZIndex: 1000,
    });
  } else {
    console.error(`[survey] No data for survey ${JSON.stringify(name)}`);
  }
}

type SurveyRecord = {
  selected: boolean;
  lastSurveyTime?: number;
};

interface SurveysDBSchema extends DBSchema {
  [SURVEY_STORE_NAME]: {
    key: string;
    value: SurveyRecord;
  };
}

function openSurveysDB() {
  return openDB<SurveysDBSchema>(SURVEY_DB_NAME, 1, {
    upgrade: (db) => {
      db.createObjectStore(SURVEY_STORE_NAME);
    },
  });
}
