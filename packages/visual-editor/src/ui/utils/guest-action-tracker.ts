/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { ActionTracker } from "../types/types.js";

export { GuestActionTracker, ACTION_TRACKER_STORAGE_KEY };

export type UserType =
  | "one_time"
  | "visitor"
  | "signed_in"
  | "can_access"
  | "engaged";

export type TrackedValues = {
  props: ComputedProperties;
  visitedPages: number;
  signedIn: boolean;
  canAccess: boolean;
  opalsRun: number;
  opalsCreated: number;
};

export type StorageUpdater = (props: TrackedValues) => TrackedValues;

export type TrackedValuesUpdate = {
  current: TrackedValues;
  change: Partial<TrackedValues>;
};

export type TrackedValuesUpdater = (values: TrackedValues) => {
  update: Partial<Omit<TrackedValues, "props">>;
  props: ComputedProperties | null;
};

/**
 * The actual properties being sent to GA. Uses snake_case for property names,
 * because this is a GA convention.
 */
export type ComputedProperties = {
  user_type: UserType;
};

const ACTION_TRACKER_STORAGE_KEY = "ga_tracked_properties";

class GuestActionTracker implements ActionTracker {
  constructor(
    private readonly host: OpalShellHostProtocol,
    private readonly supportsPropertyTracking: boolean | undefined
  ) {}

  // Property tracking

  private trackProperty(updater: TrackedValuesUpdater): void {
    if (!this.supportsPropertyTracking) return;

    updateStorage((current) => {
      const { update, props } = updater(current);
      let updated = { ...current, ...update };
      if (props !== null) {
        this.host.trackProperties(props);
        updated = { ...updated, props };
      }
      return updated;
    });
  }

  incrementVisitedPages(): void {
    this.trackProperty(({ props: current, visitedPages }) => {
      let props: ComputedProperties | null = null;
      if (current.user_type === "one_time") {
        if (visitedPages === 0) {
          // Send props change for the very first time.
          props = { user_type: "one_time" };
        } else {
          props = { user_type: "visitor" };
        }
      }
      const update = { visitedPages: visitedPages + 1 };
      return { update, props };
    });
  }

  updateSignedInStatus(signedIn: boolean): void {
    this.trackProperty(({ props: current, visitedPages }) => {
      let props: ComputedProperties | null = null;
      if (signedIn) {
        const { user_type } = current;
        // If currently below signed_in, send the "signed_in" property update.
        if (
          user_type !== "signed_in" &&
          user_type !== "can_access" &&
          user_type !== "engaged"
        ) {
          props = { user_type: "signed_in" };
        }
      } else {
        if (visitedPages < 2) {
          props = { user_type: "one_time" };
        } else {
          props = { user_type: "visitor" };
        }
      }
      const update = { signedIn };
      return { update, props };
    });
  }

  updateCanAccessStatus(canAccess: boolean): void {
    this.trackProperty(({ props: current, opalsCreated, opalsRun }) => {
      let props: ComputedProperties | null = null;
      if (canAccess) {
        const { user_type } = current;
        if (user_type !== "can_access" && user_type !== "engaged") {
          if (opalsRun > 0 || opalsCreated > 0) {
            props = { user_type: "engaged" };
          } else {
            props = { user_type: "can_access" };
          }
        }
      } else {
        props = { user_type: "signed_in" };
      }
      const update = { canAccess };
      return { update, props };
    });
  }

  incrementOpalsRan(): void {
    this.trackProperty(({ props: current, opalsRun }) => {
      let props: ComputedProperties | null = null;
      opalsRun++;
      if (current.user_type === "can_access" && opalsRun > 0) {
        props = { user_type: "engaged" };
      }
      const update = { opalsRun };
      return { update, props };
    });
  }

  incrementOpalsCreated(): void {
    this.trackProperty(({ props: current, opalsCreated }) => {
      let props: ComputedProperties | null = null;
      opalsCreated++;
      if (current.user_type === "can_access" && opalsCreated > 0) {
        props = { user_type: "engaged" };
      }
      const update = { opalsCreated };
      return { update, props };
    });
  }

  // Event tracking

  load(type: "app" | "canvas" | "landing" | "home", shared: boolean) {
    const sharedSuffix = shared ? "_shared" : "";
    this.host.trackAction(`app_load_${type}${sharedSuffix}`);
    this.incrementVisitedPages();
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
    this.incrementOpalsCreated();

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
    this.incrementOpalsCreated();
  }

  flowGenCreate() {
    this.host.trackAction("app_flowgen_create");
    this.host.trackAction("app_engage", { url: "new_flowgen" });
    this.incrementOpalsCreated();
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
    this.incrementOpalsRan();

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
    this.updateSignedInStatus(false);
  }

  signInSuccess() {
    this.host.trackAction("sign_in_success");
    this.updateSignedInStatus(true);
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

function updateStorage(updater: StorageUpdater): void {
  let before: TrackedValues;
  const propsString = globalThis.localStorage.getItem(
    ACTION_TRACKER_STORAGE_KEY
  );
  if (!propsString) {
    before = initializeValues();
  } else {
    try {
      before = JSON.parse(propsString);
    } catch {
      before = initializeValues();
    }
  }
  const after = updater(before);
  const updatedPropsString = JSON.stringify(after);
  globalThis.localStorage.setItem(
    ACTION_TRACKER_STORAGE_KEY,
    updatedPropsString
  );
}

function initializeValues(): TrackedValues {
  return {
    visitedPages: 0,
    signedIn: false,
    canAccess: false,
    opalsRun: 0,
    opalsCreated: 0,
    props: { user_type: "one_time" },
  };
}

// function computeProperties({
//   current,
//   change,
// }: TrackedValuesUpdate): ComputedPropertiesUpdate {
// if (before.signedIn && after.signedIn) {
//   if (before.canAccess && after.canAccess) {
//     if (after.opalsCreated > 0 || after.opalsRun > 0) {
//       const changed = before.opalsCreated === 0 && before.opalsRun === 0;
//       return { props: { user_type: "engaged" }, changed };
//     }
//     return { props: { user_type: "can_access" }, changed: false };
//   }
//   if (after.canAccess) {
//     return { props: { user_type: "can_access" }, changed: true };
//   }
//   return { props: { user_type: "signed_in" }, changed: false };
// }
// if (after.signedIn) {
//   return { props: { user_type: "signed_in" }, changed: true };
// }
// if (after.visitedPages > 1) {
//   const changed = before.visitedPages <= 1 || before.signedIn;
//   return { props: { user_type: "active" }, changed };
// }
// return { props: { user_type: "visitor" }, changed: true };
// }
