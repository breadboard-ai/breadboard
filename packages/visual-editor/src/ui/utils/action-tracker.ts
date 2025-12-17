/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { PartialPersistentBackend } from "../../engine/file-system/partial-persistent-backend.js";
import { createTrustedAnalyticsURL } from "../trusted-types/analytics-url.js";
import { ActionTracker } from "../types/types.js";
import { getActionTrackerLocalStroageKey } from "./gtag-action-tracker.js";
import { parseUrl } from "./urls.js";
import { GuestActionTracker } from "./guest-action-tracker.js";

export { initializeAnalytics, createActionTrackerBackend, createActionTracker };

declare global {
  interface Window {
    dataLayer: Array<IArguments>;
  }
}

/**
 * Initializes Google Analytics.
 *
 * @param id - Google Analytics measurement ID
 */
function initializeAnalytics(id: string, signedIn: boolean) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  // IP anonymized per OOGA policy.
  const userId = signedIn ? { user_id: getUserId() } : {};

  // Get site mode from the URL
  const site_mode = parseUrl(window.location.href).lite ? "lite" : "standard";

  window.gtag("config", id, {
    site_mode,
    anonymize_ip: true,
    cookie_flags: "SameSite=None; Secure",
    ...userId,
  });

  const tagManagerScript = document.createElement("script");
  (tagManagerScript as { src: string | TrustedScriptURL }).src =
    createTrustedAnalyticsURL(id);
  tagManagerScript.async = true;
  document.body.appendChild(tagManagerScript);

  function getUserId() {
    let userId = window.localStorage.getItem(getActionTrackerLocalStroageKey());
    if (!userId) {
      // Generate a random GUUID that will be associated with this user.
      userId = crypto.randomUUID();
      window.localStorage.setItem(getActionTrackerLocalStroageKey(), userId);
    }
    return userId;
  }
}

function createActionTracker(host: OpalShellHostProtocol): ActionTracker {
  return new GuestActionTracker(host);
}

function createActionTrackerBackend() {
  return new PartialPersistentBackend({
    async write(_graphUrl, path, _data) {
      const eventName = path.split("/").at(-1);
      globalThis.gtag?.("event", `step_run_${eventName}`);
    },
  });
}
