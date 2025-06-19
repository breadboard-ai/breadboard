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
      newURL.searchParams.set("tab0", url);
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

  #emit(id?: TabId, creator?: EditHistoryCreator) {
    this.dispatchEvent(
      new RuntimeURLChangeEvent(new URL(window.location.href), id, creator)
    );
  }
}
