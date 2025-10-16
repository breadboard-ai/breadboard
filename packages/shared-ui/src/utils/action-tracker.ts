/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PartialPersistentBackend } from "@google-labs/breadboard";

export { ActionTracker, initializeAnalytics, createActionTrackerBackend };

declare global {
  interface Window {
    dataLayer: Array<IArguments>;
  }
}

const LOCAL_STORAGE_KEY = "ga_user_id";
const LOCAL_STORAGE_OLD_ID_CHECKED = "old_ga_user_id_checked";

let gtagResolver: () => void;
const gtagInitialized = new Promise<void>((r) => {
  gtagResolver = r;
});

async function asyncGtag(...args: Parameters<typeof window.gtag>) {
  await gtagInitialized;
  window.gtag?.apply(window, args);
}

// TODO: get these from the right server environment vars or whatever
const LOCAL_DEV = true;
const OLD_ORIGIN = LOCAL_DEV
  ? "http://localhost:3000"
  : "https://opal.withgoogle.com";

/**
 * We moved domains from opal.withgoogle.com to opal.google, and in doing so
 * lost the user ids stored in local storage. This function creates an iframe
 * to the old domain to retrieve the user id from there, if it exists, and store
 * it in local storage on the new domain.
 */
async function maybeMoveOldUserIdToNewDomain(): Promise<void> {
  if (window.localStorage.getItem(LOCAL_STORAGE_OLD_ID_CHECKED)) {
    return;
  }
  // Create an iframe to the old domain to get the user id from there.
  const iframe = document.createElement("iframe");
  iframe.height = "0";
  iframe.width = "0";
  iframe.style.display = "none";
  iframe.src = `${OLD_ORIGIN}/ga_user_id/index.html`;
  document.body.appendChild(iframe);
  return new Promise((resolve) => {
    function resolveAndCleanup(userId: string | undefined) {
      window.removeEventListener("message", onMessage);
      document.body.removeChild(iframe);
      if (userId) {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, userId);
      }
      clearTimeout(timeout);
      resolve();
    }
    function onMessage(event: MessageEvent) {
      if (event.origin !== OLD_ORIGIN || !("ga_user_id" in event.data)) {
        return;
      }
      window.localStorage.setItem(
        LOCAL_STORAGE_OLD_ID_CHECKED,
        event.data.ga_user_id ? "true-moved" : "true-none"
      );
      resolveAndCleanup(event.data.ga_user_id);
    }
    window.addEventListener("message", onMessage);
    const timeout = setTimeout(() => {
      // Something bad happened, but we don't want to block analytics reporting
      // forever, so just move on and we'll generate a new user id
      resolveAndCleanup(undefined);
    }, 10_000);
  });
}

/**
 * Initializes Google Analytics.
 *
 * @param id - Google Analytics measurement ID
 */
async function initializeAnalytics(id: string, signedIn: boolean) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  // IP anonymized per OOGA policy.
  const userId = signedIn ? { user_id: await getUserId() } : {};

  window.gtag("config", id, {
    anonymize_ip: true,
    ...userId,
  });

  // Allow gtag calls to commence
  gtagResolver();

  const tagManagerScript = document.createElement("script");
  tagManagerScript.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  tagManagerScript.async = true;
  document.body.appendChild(tagManagerScript);

  async function getUserId() {
    await maybeMoveOldUserIdToNewDomain();
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
  static load(type: "app" | "canvas" | "landing" | "home", shared: boolean) {
    const sharedSuffix = shared ? "_shared" : "";
    asyncGtag("event", `app_load_${type}${sharedSuffix}`);
  }

  static openApp(url: string, source: "gallery" | "user") {
    asyncGtag("event", "app_open", { url, source });
    asyncGtag("event", "app_engage", { url });

    if (source === "gallery") {
      asyncGtag("event", "app_open_gallery", { url });
    } else if (source === "user") {
      asyncGtag("event", "app_open_user", { url });
    }
  }

  static remixApp(url: string, source: "gallery" | "user" | "editor") {
    asyncGtag("event", "app_remix", { url, source });
    asyncGtag("event", "app_engage", { url });

    switch (source) {
      case "gallery":
        asyncGtag("event", "app_remix_gallery", { url });
        break;
      case "user":
        asyncGtag("event", "app_remix_user", { url });
        break;
      case "editor":
        asyncGtag("event", "app_remix_editor", { url });
        break;
    }
  }

  static createNew() {
    asyncGtag("event", "app_create_new");
    asyncGtag("event", "app_engage", { url: "new" });
  }

  static flowGenCreate() {
    asyncGtag("event", "app_flowgen_create");
    asyncGtag("event", "app_engage", { url: "new_flowgen" });
  }

  static flowGenEdit(url: string | undefined) {
    if (url) {
      asyncGtag("event", "app_flowgen_edit", { url });
      asyncGtag("event", "app_engage", { url });
    } else {
      // Count first run (no url) of edit as create.
      this.flowGenCreate();
    }
  }

  static runApp(
    url: string | undefined,
    source: "app_preview" | "app_view" | "console"
  ) {
    asyncGtag("event", "app_run", { url, source });
    asyncGtag("event", "app_engage", { url });

    switch (source) {
      case "app_preview":
        asyncGtag("event", "app_run_preview", { url });
        break;
      case "app_view":
        asyncGtag("event", "app_run_view", { url });
        break;
      case "console":
        asyncGtag("event", "app_run_console", { url });
        break;
    }
  }

  static publishApp(url: string | undefined) {
    asyncGtag("event", "app_publish", { url });
    asyncGtag("event", "app_engage", { url });
  }

  static signInPageView() {
    asyncGtag("event", "sign_in_page_view");
    this.load("landing", false);
  }

  static signOutSuccess() {
    resetAnalyticsUserId();
    asyncGtag("event", "sign_out_success");
  }

  static signInSuccess() {
    resetAnalyticsUserId();
    asyncGtag("event", "sign_in_success");
  }

  static errorUnknown() {
    asyncGtag("event", "error_unknown");
  }

  static errorConfig() {
    asyncGtag("event", "error_config");
  }

  static errorRecitation() {
    asyncGtag("event", "error_recitation");
  }

  static errorCapacity(medium: string) {
    asyncGtag("event", "error_capacity", { medium });
  }

  static errorSafety() {
    asyncGtag("event", "error_safety");
  }

  static addNewStep(type?: string) {
    asyncGtag(
      "event",
      `add_step_${type?.toLocaleLowerCase().replace(/[^a-zA-Z0-9]/g, "_") || "unknown"}`
    );
  }

  static editStep(type: "manual" | "flowgen") {
    asyncGtag("event", `edit_step_${type}`);
  }

  static shareResults(type: "download" | "save_to_drive" | "copy_share_link") {
    asyncGtag("event", `share_results_${type}`);
  }
}

function createActionTrackerBackend() {
  return new PartialPersistentBackend({
    async write(_graphUrl, path, _data) {
      const eventName = path.split("/").at(-1);
      asyncGtag("event", `step_run_${eventName}`);
    },
  });
}
