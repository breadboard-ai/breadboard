/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActionTracker } from "../types/types.js";

export { ActionEventSender };

type ActionReceiver = (
  action: string,
  params?: Record<string, string | undefined>
) => void;

class ActionEventSender implements ActionTracker {
  constructor(
    private readonly receiver: ActionReceiver,
    private readonly resetAnalyticsUserId?: () => void
  ) {}

  load(type: "app" | "canvas" | "landing" | "home", shared: boolean) {
    const sharedSuffix = shared ? "_shared" : "";
    this.receiver(`app_load_${type}${sharedSuffix}`);
  }

  openApp(url: string, source: "gallery" | "user") {
    this.receiver("app_open", { url, source });
    this.receiver("app_engage", { url });

    if (source === "gallery") {
      this.receiver("app_open_gallery", { url });
    } else if (source === "user") {
      this.receiver("app_open_user", { url });
    }
  }

  remixApp(url: string, source: "gallery" | "user" | "editor") {
    this.receiver("app_remix", { url, source });
    this.receiver("app_engage", { url });

    switch (source) {
      case "gallery":
        this.receiver("app_remix_gallery", { url });
        break;
      case "user":
        this.receiver("app_remix_user", { url });
        break;
      case "editor":
        this.receiver("app_remix_editor", { url });
        break;
    }
  }

  createNew() {
    this.receiver("app_create_new");
    this.receiver("app_engage", { url: "new" });
  }

  flowGenCreate() {
    this.receiver("app_flowgen_create");
    this.receiver("app_engage", { url: "new_flowgen" });
  }

  flowGenEdit(url: string | undefined) {
    if (url) {
      this.receiver("app_flowgen_edit", { url });
      this.receiver("app_engage", { url });
    } else {
      // Count first run (no url) of edit as create.
      this.flowGenCreate();
    }
  }

  runApp(
    url: string | undefined,
    source: "app_preview" | "app_view" | "console"
  ) {
    this.receiver("app_run", { url, source });
    this.receiver("app_engage", { url });

    switch (source) {
      case "app_preview":
        this.receiver("app_run_preview", { url });
        break;
      case "app_view":
        this.receiver("app_run_view", { url });
        break;
      case "console":
        this.receiver("app_run_console", { url });
        break;
    }
  }

  publishApp(url: string | undefined) {
    this.receiver("app_publish", { url });
    this.receiver("app_engage", { url });
  }

  signOutSuccess() {
    this.resetAnalyticsUserId?.();
    this.receiver("sign_out_success");
  }

  signInSuccess() {
    this.resetAnalyticsUserId?.();
    this.receiver("sign_in_success");
  }

  errorUnknown() {
    this.receiver("error_unknown");
  }

  errorConfig() {
    this.receiver("error_config");
  }

  errorRecitation() {
    this.receiver("error_recitation");
  }

  errorCapacity(medium: string) {
    this.receiver("error_capacity", { medium });
  }

  errorSafety() {
    this.receiver("error_safety");
  }

  addNewStep(type?: string) {
    this.receiver(
      `add_step_${type?.toLocaleLowerCase().replace(/[^a-zA-Z0-9]/g, "_") || "unknown"}`
    );
  }

  editStep(type: "manual" | "flowgen") {
    this.receiver(`edit_step_${type}`);
  }

  shareResults(type: "download" | "save_to_drive" | "copy_share_link") {
    this.receiver(`share_results_${type}`);
  }
}
