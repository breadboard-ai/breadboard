/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EditHistoryCreator } from "@google-labs/breadboard";
import { RuntimeURLChangeEvent } from "./events";
import { TabId } from "./types";

export class Router extends EventTarget {
  constructor() {
    super();

    let replacedTabs = false;
    const urlWithTab = new URL(window.location.href);
    for (const [param, value] of urlWithTab.searchParams) {
      if (param === "tab0") {
        urlWithTab.searchParams.set("flow", value);
        urlWithTab.searchParams.delete("tab0");
        replacedTabs = true;
        continue;
      }

      if (param.startsWith("tab")) {
        urlWithTab.searchParams.delete(param);
        replacedTabs = true;
      }
    }

    if (replacedTabs) {
      const url = decodeURIComponent(urlWithTab.href);
      window.history.replaceState(null, "", url);
    }

    window.addEventListener("popstate", () => {
      this.#emit();
    });
  }

  go(url: string | null, id?: TabId, creator?: EditHistoryCreator) {
    if (url === window.location.href) {
      return;
    }

    if (!url || !URL.canParse(url)) {
      url = window.location.origin;
    }

    if (new URL(url).origin !== window.location.origin) {
      const newURL = new URL(window.location.origin);
      newURL.searchParams.set("flow", url);
      url = newURL.href;
    }

    // Ensure that the URL doesn't contain escaped characters for board URLs.
    url = decodeURIComponent(url);
    window.history.pushState(null, "", url);
    this.#emit(id, creator);
  }

  init() {
    this.#emit();
  }

  clearFlowParameters() {
    const pageUrl = new URL(window.location.href);
    const tabs = [...pageUrl.searchParams].filter(
      ([id]) => id.startsWith("tab") || id.startsWith("flow")
    );

    for (const [id] of tabs) {
      pageUrl.searchParams.delete(id);
    }

    window.history.replaceState(null, "", pageUrl);
  }

  #emit(id?: TabId, creator?: EditHistoryCreator) {
    this.dispatchEvent(
      new RuntimeURLChangeEvent(new URL(window.location.href), id, creator)
    );
  }
}
