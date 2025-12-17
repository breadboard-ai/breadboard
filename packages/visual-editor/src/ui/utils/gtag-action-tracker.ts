/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActionTracker } from "../types/types.js";

export { GTagActionTracker, getActionTrackerLocalStroageKey };

function getActionTrackerLocalStroageKey() {
  // b/458498343 This should be simply be a module-scope const
  // LOCAL_STORAGE_KEY. However there appears to be a bug affecting iOS 18 such
  // that exported functions can be invoked by importers before module-level
  // consts are initialized. It only affects our bundled production mode, but
  // the relevant module factoring is similar, so it seems more like a JSC bug
  // than a bundler bug. As a hacky workaround, writing this as a hoisted
  // function corrects the ordering.
  return "ga_user_id";
}

class GTagActionTracker implements ActionTracker {
  load(type: "app" | "canvas" | "landing" | "home", shared: boolean) {
    const sharedSuffix = shared ? "_shared" : "";
    globalThis.gtag?.("event", `app_load_${type}${sharedSuffix}`);
  }

  openApp(url: string, source: "gallery" | "user") {
    globalThis.gtag?.("event", "app_open", { url, source });
    globalThis.gtag?.("event", "app_engage", { url });

    if (source === "gallery") {
      globalThis.gtag?.("event", "app_open_gallery", { url });
    } else if (source === "user") {
      globalThis.gtag?.("event", "app_open_user", { url });
    }
  }

  remixApp(url: string, source: "gallery" | "user" | "editor") {
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

  createNew() {
    globalThis.gtag?.("event", "app_create_new");
    globalThis.gtag?.("event", "app_engage", { url: "new" });
  }

  flowGenCreate() {
    globalThis.gtag?.("event", "app_flowgen_create");
    globalThis.gtag?.("event", "app_engage", { url: "new_flowgen" });
  }

  flowGenEdit(url: string | undefined) {
    if (url) {
      globalThis.gtag?.("event", "app_flowgen_edit", { url });
      globalThis.gtag?.("event", "app_engage", { url });
    } else {
      // Count first run (no url) of edit as create.
      this.flowGenCreate();
    }
  }

  runApp(
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

  publishApp(url: string | undefined) {
    globalThis.gtag?.("event", "app_publish", { url });
    globalThis.gtag?.("event", "app_engage", { url });
  }

  signOutSuccess() {
    resetAnalyticsUserId();
    globalThis.gtag?.("event", "sign_out_success");
  }

  signInSuccess() {
    resetAnalyticsUserId();
    globalThis.gtag?.("event", "sign_in_success");
  }

  errorUnknown() {
    globalThis.gtag?.("event", "error_unknown");
  }

  errorConfig() {
    globalThis.gtag?.("event", "error_config");
  }

  errorRecitation() {
    globalThis.gtag?.("event", "error_recitation");
  }

  errorCapacity(medium: string) {
    globalThis.gtag?.("event", "error_capacity", { medium });
  }

  errorSafety() {
    globalThis.gtag?.("event", "error_safety");
  }

  addNewStep(type?: string) {
    globalThis.gtag?.(
      "event",
      `add_step_${type?.toLocaleLowerCase().replace(/[^a-zA-Z0-9]/g, "_") || "unknown"}`
    );
  }

  editStep(type: "manual" | "flowgen") {
    globalThis.gtag?.("event", `edit_step_${type}`);
  }

  shareResults(type: "download" | "save_to_drive" | "copy_share_link") {
    globalThis.gtag?.("event", `share_results_${type}`);
  }
}

function resetAnalyticsUserId() {
  window.localStorage.removeItem(getActionTrackerLocalStroageKey());
}
