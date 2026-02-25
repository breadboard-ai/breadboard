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

/**
 * Initializes Google Analytics.
 *
 * @param id - Google Analytics measurement ID
 */
async function initializeAnalytics(id: string): Promise<void> {
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

  // Get site mode from the URL
  const site_mode = parseUrl(window.location.href).lite ? "lite" : "standard";

  // IP anonymized per OOGA policy.
  window.gtag("config", id, {
    site_mode,
    anonymize_ip: true,
    cookie_flags: "SameSite=None; Secure",
  });
}

function shouldSend() {
  return !window.location.href.includes("localhost:3000");
}

class GTagEventSender {
  private readonly initialized: Promise<void> | undefined;

  constructor(measurementId: string | undefined) {
    if (!shouldSend()) return;
    if (measurementId) {
      this.initialized = initializeAnalytics(measurementId);
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
    sendGTagEvent(action, params);
  }
}

function sendGTagEvent(
  action: string,
  params?: Record<string, string | undefined>
) {
  if (!shouldSend()) return;
  globalThis.gtag?.("event", action, params);
}
