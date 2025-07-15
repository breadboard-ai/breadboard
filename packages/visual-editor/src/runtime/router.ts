/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EditHistoryCreator } from "@google-labs/breadboard";
import { RuntimeURLChangeEvent } from "./events";
import { TabId, VisualEditorMode } from "./types";

export class Router extends EventTarget {
  constructor() {
    super();

    let replaceParams = false;
    const urlWithParams = new URL(window.location.href);
    for (const [param, value] of urlWithParams.searchParams) {
      if (param === "tab0") {
        urlWithParams.searchParams.set("flow", value);
        urlWithParams.searchParams.delete("tab0");
        replaceParams = true;
        continue;
      }

      if (param.startsWith("tab")) {
        urlWithParams.searchParams.delete(param);
        replaceParams = true;
      }

      if (param === "redirect-from-landing") {
        urlWithParams.searchParams.delete(param);
        replaceParams = true;
      }
    }

    if (!urlWithParams.searchParams.has("mode")) {
      // Default mode is canvas.
      urlWithParams.searchParams.set("mode", "canvas");
      replaceParams = true;
    }

    if (replaceParams) {
      const url = decodeURIComponent(urlWithParams.href);
      window.history.replaceState(null, "", url);
    }

    window.addEventListener("popstate", () => {
      this.#emit();
    });
  }

  go(
    url: string | null,
    mode: VisualEditorMode,
    id?: TabId,
    creator?: EditHistoryCreator
  ) {
    // Any invalid or null URLs should redirect to the origin.
    if (!url || !URL.canParse(url)) {
      url = window.location.origin;
    }

    // If the URL passed doesn't match the Visual Editor origin we assume that
    // it is a thing to be loaded so we stack it on as a URL parameter.
    let urlWithMode = new URL(url);
    if (urlWithMode.origin !== window.location.origin) {
      const newURL = new URL(window.location.origin);
      newURL.searchParams.set("flow", url);
      url = newURL.href;
      urlWithMode = new URL(url);
    }

    // If, however, the constructed URL & mode match the current then we can
    // assume a noop here and early exit.
    if (
      url === window.location.href &&
      urlWithMode.searchParams.get("mode") === mode
    ) {
      return;
    }

    // Next ensure that the provided mode is represented in the URL.
    urlWithMode.searchParams.set("mode", mode);
    url = urlWithMode.href;

    // And finally ensure that the URL doesn't contain escaped characters.
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
    let mode: VisualEditorMode = "canvas";
    const urlWithParams = new URL(window.location.href);
    const urlMode = urlWithParams.searchParams.get("mode");
    if (urlMode && (urlMode === "app" || urlMode === "canvas")) {
      mode = urlMode;
    }
    const resultsFileId =
      urlWithParams.searchParams.get("results") ?? undefined;

    this.dispatchEvent(
      new RuntimeURLChangeEvent(
        new URL(window.location.href),
        mode,
        id,
        creator,
        resultsFileId
      )
    );
  }
}
