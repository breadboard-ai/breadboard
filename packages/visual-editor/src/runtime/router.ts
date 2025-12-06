/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EditHistoryCreator } from "@breadboard-ai/types";
import { signal } from "signal-utils";
import { MakeUrlInit, ParsedUrlProvider } from "../ui/types/types.js";
import { makeUrl, parseUrl } from "../ui/utils/urls.js";
import { RuntimeURLChangeEvent } from "./events.js";
import { type TabId } from "./types.js";

export class Router extends EventTarget implements ParsedUrlProvider {
  @signal
  accessor parsedUrl: MakeUrlInit;

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
    this.parsedUrl = parsed;
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
    this.parsedUrl = currentParsed;
    const mode = currentParsed.page === "graph" ? currentParsed.mode : "canvas";
    const resultsFileId =
      currentParsed.page === "graph" ? currentParsed.results : undefined;

    this.dispatchEvent(
      new RuntimeURLChangeEvent(currentUrl, mode, id, creator, resultsFileId)
    );
  }
}
