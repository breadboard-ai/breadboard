/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RootController } from "../root-controller.js";
import { GlobalConfig } from "../../../../ui/contexts/global-config.js";
import { createTrustedFeedbackURL } from "../../../../ui/trusted-types/feedback-url.js";
import { field } from "../../decorators/field.js";
import type { TrustedScriptURL } from "trusted-types/lib/index.js";

type UserFeedbackApi = {
  startFeedback(
    configuration: {
      productId: string;
      bucket?: string;
      productVersion?: string;
      callback?: () => void;
      onLoadCallback?: () => void;
    },
    productData?: { [key: string]: string }
  ): void;
};

type WindowWithUserFeedbackApi = Window &
  typeof globalThis & {
    userfeedback: { api: UserFeedbackApi };
  };

let googleFeedbackApiPromise: Promise<UserFeedbackApi> | undefined;
function loadGoogleFeedbackApi(): Promise<UserFeedbackApi> {
  if (googleFeedbackApiPromise) {
    return googleFeedbackApiPromise;
  }

  googleFeedbackApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    (script as { src: string | TrustedScriptURL }).src =
      createTrustedFeedbackURL("");
    script.async = true;
    script.addEventListener(
      "load",
      () => resolve((window as WindowWithUserFeedbackApi).userfeedback.api),
      { once: true }
    );
    script.addEventListener("error", (reason) => reject(reason), {
      once: true,
    });
    document.body.appendChild(script);
  });

  return googleFeedbackApiPromise;
}

export type FeedbackStatus = "closed" | "loading" | "open";

export class FeedbackController extends RootController {
  @field()
  accessor status: FeedbackStatus = "closed";

  async open(globalConfig: GlobalConfig) {
    if (this.status !== "closed") {
      return;
    }

    if (!globalConfig) {
      console.error(`No environment was provided.`);
      return;
    }
    const productId = globalConfig.GOOGLE_FEEDBACK_PRODUCT_ID;
    if (!productId) {
      console.error(
        `No GOOGLE_FEEDBACK_PRODUCT_ID was set` +
          ` in the client deployment configuration.`
      );
      return;
    }
    const bucket = globalConfig.GOOGLE_FEEDBACK_BUCKET;
    if (!bucket) {
      console.error(
        `No GOOGLE_FEEDBACK_BUCKET was set` +
          ` in the client deployment configuration.`
      );
      return;
    }
    const { packageJsonVersion: version, gitCommitHash } =
      globalConfig.buildInfo;

    this.status = "loading";
    let api;
    try {
      api = await loadGoogleFeedbackApi();
    } catch (e) {
      /* c8 ignore next 4 */
      console.error(`Error loading Google Feedback script: ${e}`);
      this.status = "closed";
      return;
    }

    if (this.status !== "loading") {
      /* c8 ignore next 4 */
      // The user might have pressed Escape on the loading panel in the
      // meantime.
      return;
    }

    api.startFeedback({
      productId,
      bucket,
      productVersion: `${version} (${gitCommitHash})`,
      onLoadCallback: () => {
        // Note that the API we loaded earlier is very tiny. This startFeedback
        // call is what actually loads most of the JavaScript, so we want to
        // keep the loading indicator visible until this callback fires.
        this.status = "open";
      },
      callback: () => {
        this.status = "closed";
      },
    });
  }

  close() {
    this.status = "closed";
  }
}
