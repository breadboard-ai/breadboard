/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  makeUrl,
  type MakeUrlInit,
  parseUrl,
} from "@breadboard-ai/shared-ui/utils/urls.js";
import { type EditHistoryCreator } from "@google-labs/breadboard";
import { RuntimeURLChangeEvent } from "./events.js";
import { type TabId } from "./types.js";

export class Router extends EventTarget {
  constructor() {
    super();
    const parsed = parseUrl(window.location.href);
    if ("redirectFromLanding" in parsed) {
      parsed.redirectFromLanding = false;
    }
    const canonicalized = makeUrl(parsed);
    if (window.location.href !== canonicalized) {
      window.history.replaceState(null, "", canonicalized);
    }
    window.addEventListener("popstate", () => {
      this.#emit();
    });
  }

  go(init: MakeUrlInit, tabId?: TabId, creator?: EditHistoryCreator) {
    const url = makeUrl(init);
    if (url !== window.location.href) {
      window.history.pushState(null, "", url);
      this.#emit(tabId, creator);
    }
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
    const currentUrl = new URL(window.location.href);
    const currentParsed = parseUrl(currentUrl);
    const mode = currentParsed.page === "graph" ? currentParsed.mode : "canvas";
    const resultsFileId =
      currentParsed.page === "graph" ? currentParsed.results : undefined;

    this.dispatchEvent(
      new RuntimeURLChangeEvent(currentUrl, mode, id, creator, resultsFileId)
    );
  }
}
