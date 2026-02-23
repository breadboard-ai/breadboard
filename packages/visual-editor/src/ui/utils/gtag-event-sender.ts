/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createTrustedAnalyticsURL } from "../trusted-types/analytics-url.js";
import { parseUrl } from "../navigation/urls.js";

export { GTagEventSender };

declare global {
  interface Window {
    dataLayer: Array<IArguments>;
  }
}

function getActionTrackerLocalStorageKey() {
  // b/458498343 This should be simply be a module-scope const
  // LOCAL_STORAGE_KEY. However there appears to be a bug affecting iOS 18 such
  // that exported functions can be invoked by importers before module-level
  // consts are initialized. It only affects our bundled production mode, but
  // the relevant module factoring is similar, so it seems more like a JSC bug
  // than a bundler bug. As a hacky workaround, writing this as a hoisted
  // function corrects the ordering.
  return "ga_user_id";
}

/**
 * Initializes Google Analytics.
 *
 * @param id - Google Analytics measurement ID
 */
async function initializeAnalytics(
  id: string,
  signedInCallback: () => Promise<boolean>
): Promise<void> {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());

  // Load the tag manager script.
  const tagManagerScript = document.createElement("script");
  (tagManagerScript as { src: string | TrustedScriptURL }).src =
    createTrustedAnalyticsURL(id);
  tagManagerScript.async = true;
  document.body.appendChild(tagManagerScript);

  const signedIn = await signedInCallback();

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

  function getUserId() {
    let userId = window.localStorage.getItem(getActionTrackerLocalStorageKey());
    if (!userId) {
      // Generate a random GUUID that will be associated with this user.
      userId = crypto.randomUUID();
      window.localStorage.setItem(getActionTrackerLocalStorageKey(), userId);
    }
    return userId;
  }
}

function shouldSend() {
  return !window.location.href.includes("localhost:3000");
}

class GTagEventSender {
  private readonly initialized: Promise<void> | undefined;

  constructor(
    measurementId: string | undefined,
    signedInCallback: () => Promise<boolean>
  ) {
    if (!shouldSend()) return;
    if (measurementId) {
      this.initialized = initializeAnalytics(measurementId, signedInCallback);
    }
  }

  async setProperties(properties: Record<string, string | undefined>) {
    if (!this.initialized) return;
    if (!shouldSend()) return;

    await this.initialized;
    globalThis.gtag?.("set", "user_properties", properties);
    globalThis.gtag?.("event", "user_property_update", properties);
  }

  async sendEvent(action: string, params?: Record<string, string | undefined>) {
    if (!this.initialized) return;
    if (!shouldSend()) return;

    await this.initialized;
    if (action === "sign_out_success" || action === "sign_in_success") {
      resetAnalyticsUserId();
    }
    sendGTagEvent(action, params);
  }
}

function sendGTagEvent(
  action: string,
  params?: Record<string, string | undefined>
) {
  if (!shouldSend()) return;
  if (action === "sign_out_success" || action === "sign_in_success") {
    resetAnalyticsUserId();
  }
  globalThis.gtag?.("event", action, params);
}

function resetAnalyticsUserId() {
  window.localStorage.removeItem(getActionTrackerLocalStorageKey());
}
