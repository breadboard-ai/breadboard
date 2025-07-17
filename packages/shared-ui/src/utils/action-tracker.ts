/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { ActionTracker, initializeAnalytics };

declare global {
  interface Window {
    dataLayer: Array<IArguments>;
  }
}

const LOCAL_STORAGE_KEY = "ga_user_id";

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

  window.gtag("config", id, {
    anonymize_ip: true,
    ...userId,
  });

  const tagManagerScript = document.createElement("script");
  tagManagerScript.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  tagManagerScript.async = true;
  document.body.appendChild(tagManagerScript);

  function getUserId() {
    let userId = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!userId) {
      // Generate a random GUUID that will be associated with this user.
      userId = crypto.randomUUID();
      window.localStorage.setItem(LOCAL_STORAGE_KEY, userId);
    }
    return userId;
  }
}

function resetAnalyticsUserId() {
  window.localStorage.removeItem(LOCAL_STORAGE_KEY);
}

/**
 * A simple wrapper to keep all GA invocations in one place.
 */

class ActionTracker {
  static openApp(url: string, source: "gallery" | "user") {
    globalThis.gtag?.("event", "app_open", { url, source });

    if (source === "gallery") {
      globalThis.gtag?.("event", "app_open_gallery", { url });
    } else if (source === "user") {
      globalThis.gtag?.("event", "app_open_user", { url });
    }
  }

  static remixApp(url: string, source: "gallery" | "user" | "editor") {
    globalThis.gtag?.("event", "app_remix", { url, source });

    switch (source) {
      case "gallery":
        globalThis.gtag?.("event", "app_remix_gallery", { url });
        break;
      case "user":
        globalThis.gtag?.("event", "app_remix_user", { url });
        break;
      case "editor":
        globalThis.gtag?.("event", "app_remix_editor", { url });
        break;
    }
  }

  static createNew() {
    globalThis.gtag?.("event", "app_create_new");
  }

  static flowGenCreate() {
    globalThis.gtag?.("event", "app_flowgen_create");
  }

  static flowGenEdit(url: string | undefined) {
    globalThis.gtag?.("event", "app_flowgen_edit", { url });
  }

  static runApp(
    url: string | undefined,
    source: "app_preview" | "app_view" | "console"
  ) {
    globalThis.gtag?.("event", "app_run", { url, source });

    switch (source) {
      case "app_preview":
        globalThis.gtag?.("event", "app_run_preview", { url });
        break;
      case "app_view":
        globalThis.gtag?.("event", "app_run_view", { url });
        break;
      case "console":
        globalThis.gtag?.("event", "app_run_console", { url });
        break;
    }
  }

  static publishApp(url: string | undefined) {
    globalThis.gtag?.("event", "app_publish", { url });
  }

  static signInPageView() {
    globalThis.gtag?.("event", "sign_in_page_view");
  }

  static signOutSuccess() {
    resetAnalyticsUserId();
    globalThis.gtag?.("event", "sign_out_success");
  }

  static signInSuccess() {
    resetAnalyticsUserId();
    globalThis.gtag?.("event", "sign_in_success");
  }
}
