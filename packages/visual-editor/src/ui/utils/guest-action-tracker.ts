/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { ActionTracker } from "../types/types.js";
import { GTagActionTracker } from "./gtag-action-tracker.js";

export { GuestActionTracker };

class GuestActionTracker implements ActionTracker {
  tracker: ActionTracker;

  // TODO: Make host private once finished refactoring.
  constructor(public readonly host: OpalShellHostProtocol) {
    this.tracker = new GTagActionTracker();
  }

  load(type: "app" | "canvas" | "landing" | "home", shared: boolean): void {
    console.debug("[tracking] load", type, shared);
    this.tracker.load(type, shared);
  }
  openApp(url: string, source: "gallery" | "user"): void {
    console.debug("[tracking] openApp", url, source);
    this.tracker.openApp(url, source);
  }
  remixApp(url: string, source: "gallery" | "user" | "editor"): void {
    console.debug("[tracking] remixApp", url, source);
    this.tracker.remixApp(url, source);
  }
  createNew(): void {
    console.debug("[tracking] createNew");
    this.tracker.createNew();
  }
  flowGenCreate(): void {
    console.debug("[tracking] flowGenCreate");
    this.tracker.flowGenCreate();
  }
  flowGenEdit(url: string | undefined): void {
    console.debug("[tracking] flowGenEdit", url);
    this.tracker.flowGenEdit(url);
  }
  runApp(
    url: string | undefined,
    source: "app_preview" | "app_view" | "console"
  ): void {
    console.debug("[tracking] runApp", url, source);
    this.tracker.runApp(url, source);
  }
  publishApp(url: string | undefined): void {
    console.debug("[tracking] publishApp", url);
    this.tracker.publishApp(url);
  }
  signInPageView(): void {
    console.debug("[tracking] signInPageView");
    this.tracker.signInPageView();
  }
  signOutSuccess(): void {
    console.debug("[tracking] signOutSuccess");
    this.tracker.signOutSuccess();
  }
  signInSuccess(): void {
    console.debug("[tracking] signInSuccess");
    this.tracker.signInSuccess();
  }
  errorUnknown(): void {
    console.debug("[tracking] errorUnknown");
    this.tracker.errorUnknown();
  }
  errorConfig(): void {
    console.debug("[tracking] errorConfig");
    this.tracker.errorConfig();
  }
  errorRecitation(): void {
    console.debug("[tracking] errorRecitation");
    this.tracker.errorRecitation();
  }
  errorCapacity(medium: string): void {
    console.debug("[tracking] errorCapacity", medium);
    this.tracker.errorCapacity(medium);
  }
  errorSafety(): void {
    console.debug("[tracking] errorSafety");
    this.tracker.errorSafety();
  }
  addNewStep(type?: string): void {
    console.debug("[tracking] addNewStep", type);
    this.tracker.addNewStep(type);
  }
  editStep(type: "manual" | "flowgen"): void {
    console.debug("[tracking] editStep", type);
    this.tracker.editStep(type);
  }
  shareResults(type: "download" | "save_to_drive" | "copy_share_link"): void {
    console.debug("[tracking] shareResults", type);
    this.tracker.shareResults(type);
  }
}
