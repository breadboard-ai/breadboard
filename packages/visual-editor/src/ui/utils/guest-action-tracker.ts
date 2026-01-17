/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { ActionTracker } from "../types/types.js";

export { GuestActionTracker, computeProperties };

export type TrackedValues = {
  visitedPages: number;
  signedIn: boolean;
  canAccess: boolean;
  opalsRun: number;
  opalsCreated: number;
};

export type TrackedValuesUpdater = (
  props: TrackedValues
) => Partial<TrackedValues>;

export type TrackedValuesUpdate = {
  before: TrackedValues;
  after: TrackedValues;
};

export type ComputedProperties = {
  user_type: "visitor" | "active" | "signed_in" | "can_access" | "engaged";
};

type ComputedPropertiesUpdate = {
  props: ComputedProperties;
  changed: boolean;
};

class GuestActionTracker implements ActionTracker {
  constructor(private readonly host: OpalShellHostProtocol) {}

  // Property tracking

  private trackProperty(updater: TrackedValuesUpdater): void {
    const { changed, props } = computeProperties(updateValues(updater));
    if (changed) {
      this.host.trackProperties(props);
    }
  }

  incrementVisitedPages(): void {
    this.trackProperty((v) => ({ visitedPages: v.visitedPages + 1 }));
  }

  updateSignedInStatus(signedIn: boolean): void {
    this.trackProperty(() => ({ signedIn }));
  }

  updateCanAccessStatus(canAccess: boolean): void {
    this.trackProperty(() => ({
      signedIn: true, // must be true at this point
      canAccess,
    }));
  }

  incrementOpalsRan(): void {
    this.trackProperty((v) => ({ opalsRun: v.opalsRun + 1 }));
  }

  incrementOpalsCreated(): void {
    this.trackProperty((v) => ({ opalsCreated: v.opalsCreated + 1 }));
  }

  // Event tracking

  load(type: "app" | "canvas" | "landing" | "home", shared: boolean) {
    const sharedSuffix = shared ? "_shared" : "";
    this.host.trackAction(`app_load_${type}${sharedSuffix}`);
  }

  openApp(url: string, source: "gallery" | "user") {
    this.host.trackAction("app_open", { url, source });
    this.host.trackAction("app_engage", { url });

    if (source === "gallery") {
      this.host.trackAction("app_open_gallery", { url });
    } else if (source === "user") {
      this.host.trackAction("app_open_user", { url });
    }
  }

  remixApp(url: string, source: "gallery" | "user" | "editor") {
    this.host.trackAction("app_remix", { url, source });
    this.host.trackAction("app_engage", { url });

    switch (source) {
      case "gallery":
        this.host.trackAction("app_remix_gallery", { url });
        break;
      case "user":
        this.host.trackAction("app_remix_user", { url });
        break;
      case "editor":
        this.host.trackAction("app_remix_editor", { url });
        break;
    }
  }

  createNew() {
    this.host.trackAction("app_create_new");
    this.host.trackAction("app_engage", { url: "new" });
  }

  flowGenCreate() {
    this.host.trackAction("app_flowgen_create");
    this.host.trackAction("app_engage", { url: "new_flowgen" });
  }

  flowGenEdit(url: string | undefined) {
    if (url) {
      this.host.trackAction("app_flowgen_edit", { url });
      this.host.trackAction("app_engage", { url });
    } else {
      // Count first run (no url) of edit as create.
      this.flowGenCreate();
    }
  }

  runApp(
    url: string | undefined,
    source: "app_preview" | "app_view" | "console"
  ) {
    this.host.trackAction("app_run", { url, source });
    this.host.trackAction("app_engage", { url });

    switch (source) {
      case "app_preview":
        this.host.trackAction("app_run_preview", { url });
        break;
      case "app_view":
        this.host.trackAction("app_run_view", { url });
        break;
      case "console":
        this.host.trackAction("app_run_console", { url });
        break;
    }
  }

  publishApp(url: string | undefined) {
    this.host.trackAction("app_publish", { url });
    this.host.trackAction("app_engage", { url });
  }

  signOutSuccess() {
    this.host.trackAction("sign_out_success");
  }

  signInSuccess() {
    this.host.trackAction("sign_in_success");
  }

  errorUnknown() {
    this.host.trackAction("error_unknown");
  }

  errorConfig() {
    this.host.trackAction("error_config");
  }

  errorRecitation() {
    this.host.trackAction("error_recitation");
  }

  errorCapacity(medium: string) {
    this.host.trackAction("error_capacity", { medium });
  }

  errorSafety() {
    this.host.trackAction("error_safety");
  }

  addNewStep(type?: string) {
    this.host.trackAction(
      `add_step_${type?.toLocaleLowerCase().replace(/[^a-zA-Z0-9]/g, "_") || "unknown"}`
    );
  }

  editStep(type: "manual" | "flowgen") {
    this.host.trackAction(`edit_step_${type}`);
  }

  shareResults(type: "download" | "save_to_drive" | "copy_share_link") {
    this.host.trackAction(`share_results_${type}`);
  }
}

const LOCAL_STORAGE_KEY = "opal_ga_tracked_properties";
function updateValues(updater: TrackedValuesUpdater): TrackedValuesUpdate {
  let before: TrackedValues;
  const propsString = globalThis.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!propsString) {
    before = initializeProps();
  } else {
    try {
      before = JSON.parse(propsString);
    } catch {
      before = initializeProps();
    }
  }
  const after = { ...before, ...updater(before) };
  const updatedPropsString = JSON.stringify(after);
  globalThis.localStorage.setItem(LOCAL_STORAGE_KEY, updatedPropsString);
  return { before, after };
}

function initializeProps(): TrackedValues {
  return {
    visitedPages: 0,
    signedIn: false,
    canAccess: false,
    opalsRun: 0,
    opalsCreated: 0,
  };
}

function computeProperties({
  before,
  after,
}: TrackedValuesUpdate): ComputedPropertiesUpdate {
  if (before.signedIn && after.signedIn) {
    if (before.canAccess && after.canAccess) {
      if (after.opalsCreated > 0 || after.opalsRun > 0) {
        const changed = before.opalsCreated === 0 && before.opalsRun === 0;
        return { props: { user_type: "engaged" }, changed };
      }
      return { props: { user_type: "can_access" }, changed: false };
    }
    if (after.canAccess) {
      return { props: { user_type: "can_access" }, changed: true };
    }
    return { props: { user_type: "signed_in" }, changed: false };
  }
  if (after.signedIn) {
    return { props: { user_type: "signed_in" }, changed: true };
  }
  if (after.visitedPages > 1) {
    const changed = before.visitedPages <= 1 || before.signedIn;
    return { props: { user_type: "active" }, changed };
  }
  return { props: { user_type: "visitor" }, changed: true };
}
