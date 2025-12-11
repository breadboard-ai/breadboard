/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PartialPersistentBackend } from "../../engine/file-system/partial-persistent-backend.js";
import { createTrustedAnalyticsURL } from "../trusted-types/analytics-url.js";
import { parseUrl } from "./urls.js";

export { ActionTracker, initializeAnalytics, createActionTrackerBackend };

declare global {
  interface Window {
    dataLayer: Array<IArguments>;
  }
}

function getLocalStorageKey() {
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
    let userId = window.localStorage.getItem(getLocalStorageKey());
    if (!userId) {
      // Generate a random GUUID that will be associated with this user.
      userId = crypto.randomUUID();
      window.localStorage.setItem(getLocalStorageKey(), userId);
    }
    return userId;
  }
}

function resetAnalyticsUserId() {
  window.localStorage.removeItem(getLocalStorageKey());
}

/**
 * A simple wrapper to keep all GA invocations in one place.
 */

class ActionTracker {
  static load(type: "app" | "canvas" | "landing" | "home", shared: boolean) {
    const sharedSuffix = shared ? "_shared" : "";
    globalThis.gtag?.("event", `app_load_${type}${sharedSuffix}`);
  }

  static openApp(url: string, source: "gallery" | "user") {
    globalThis.gtag?.("event", "app_open", { url, source });
    globalThis.gtag?.("event", "app_engage", { url });

    if (source === "gallery") {
      globalThis.gtag?.("event", "app_open_gallery", { url });
    } else if (source === "user") {
      globalThis.gtag?.("event", "app_open_user", { url });
    }
  }

  static remixApp(url: string, source: "gallery" | "user" | "editor") {
    globalThis.gtag?.("event", "app_remix", { url, source });
    globalThis.gtag?.("event", "app_engage", { url });

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
    globalThis.gtag?.("event", "app_engage", { url: "new" });
  }

  static flowGenCreate() {
    globalThis.gtag?.("event", "app_flowgen_create");
    globalThis.gtag?.("event", "app_engage", { url: "new_flowgen" });
  }

  static flowGenEdit(url: string | undefined) {
    if (url) {
      globalThis.gtag?.("event", "app_flowgen_edit", { url });
      globalThis.gtag?.("event", "app_engage", { url });
    } else {
      // Count first run (no url) of edit as create.
      this.flowGenCreate();
    }
  }

  static runApp(
    url: string | undefined,
    source: "app_preview" | "app_view" | "console"
  ) {
    globalThis.gtag?.("event", "app_run", { url, source });
    globalThis.gtag?.("event", "app_engage", { url });

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
    globalThis.gtag?.("event", "app_engage", { url });
  }

  static signInPageView() {
    globalThis.gtag?.("event", "sign_in_page_view");
    this.load("landing", false);
  }

  static signOutSuccess() {
    resetAnalyticsUserId();
    globalThis.gtag?.("event", "sign_out_success");
  }

  static signInSuccess() {
    resetAnalyticsUserId();
    globalThis.gtag?.("event", "sign_in_success");
  }

  static errorUnknown() {
    globalThis.gtag?.("event", "error_unknown");
  }

  static errorConfig() {
    globalThis.gtag?.("event", "error_config");
  }

  static errorRecitation() {
    globalThis.gtag?.("event", "error_recitation");
  }

  static errorCapacity(medium: string) {
    globalThis.gtag?.("event", "error_capacity", { medium });
  }

  static errorSafety() {
    globalThis.gtag?.("event", "error_safety");
  }

  static addNewStep(type?: string) {
    globalThis.gtag?.(
      "event",
      `add_step_${type?.toLocaleLowerCase().replace(/[^a-zA-Z0-9]/g, "_") || "unknown"}`
    );
  }

  static editStep(type: "manual" | "flowgen") {
    globalThis.gtag?.("event", `edit_step_${type}`);
  }

  static shareResults(type: "download" | "save_to_drive" | "copy_share_link") {
    globalThis.gtag?.("event", `share_results_${type}`);
  }
}

function createActionTrackerBackend() {
  return new PartialPersistentBackend({
    async write(_graphUrl, path, _data) {
      const eventName = path.split("/").at(-1);
      globalThis.gtag?.("event", `step_run_${eventName}`);
    },
  });
}
