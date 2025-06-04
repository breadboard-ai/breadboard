/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { ActionTracker };

/**
 * A simple wrapper to keep all GA invocations in one place.
 */

class ActionTracker {
  static openApp(url: string, source: "gallery" | "user") {
    globalThis.gtag?.("event", "app_open", { url, source });
  }

  static remixApp(url: string, source: "gallery" | "user" | "editor") {
    globalThis.gtag?.("event", "app_remix", { url, source });
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
  }

  static publishApp(url: string | undefined) {
    globalThis.gtag?.("event", "app_publish", { url });
  }
}
