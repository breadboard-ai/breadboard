/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";

const { SURVEY_API_KEY } = CLIENT_DEPLOYMENT_CONFIG;
const SURVEY_API_URL =
  "https://www.gstatic.com/feedback/js/help/prod/service/lazy.min.js";

export type SurveyLib = {
  requestSurvey(config: {
    triggerId: string;
    enableTestingMode?: boolean;
    thirdPartyDomainSupportEnabled?: boolean;
    callback: (result: { surveyData: unknown }) => unknown;
  }): void;

  presentSurvey(config: {
    surveyData: unknown;
    colorScheme?: /* light (default) */ 1 | /* dark */ 2;
    customZIndex?: number;
  }): void;
};

type GlobalThisWithSurveyLib = typeof globalThis & {
  help: {
    service: {
      Lazy: {
        create: (
          productId: number,
          config: {
            apiKey: string;
            locale: string;
          }
        ) => SurveyLib;
      };
    };
  };
};

let surveyLibPromise: Promise<SurveyLib>;

export async function loadExternalSurveyLibOnce(): Promise<SurveyLib> {
  return (surveyLibPromise ??= (async () => {
    if (!SURVEY_API_KEY) {
      throw new Error(`Can't load survey API without SURVEY_API_KEY`);
    }
    const script = document.createElement("script");
    script.src = SURVEY_API_URL;
    script.async = true;
    await new Promise<void>((resolve, reject) => {
      script.addEventListener("load", () => resolve());
      script.addEventListener("error", (event) => reject(event.error));
      document.head.appendChild(script);
    });
    const { help } = globalThis as GlobalThisWithSurveyLib;
    return help.service.Lazy.create(
      /* product id is unnecessary for surveys */ 0,
      { apiKey: SURVEY_API_KEY, locale: "en-US" }
    );
  })());
}
