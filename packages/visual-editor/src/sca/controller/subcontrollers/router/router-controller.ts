/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MakeUrlInit, ParsedUrlProvider } from "../../../../ui/types/types.js";
import { makeUrl, parseUrl } from "../../../../ui/utils/urls.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * Controller managing URL state and browser navigation.
 *
 * Replaces the legacy `Runtime.Router` class with a signal-based, SCA-compliant
 * implementation. All URL state is reactive via the `@field` decorator,
 * enabling efficient reactivity across the application.
 *
 * **Responsibilities:**
 * - Maintains the current parsed URL state (`parsedUrl`)
 * - Provides navigation via `go()` method
 * - Handles URL canonicalization on initialization
 * - Clears flow/tab parameters when needed
 *
 * @example
 * ```typescript
 * // Navigate to a new board
 * sca.controller.router.go({
 *   page: "graph",
 *   mode: "canvas",
 *   flow: "drive:/12345",
 *   guestPrefixed: true,
 * });
 *
 * // React to URL changes
 * const title = sca.controller.router.parsedUrl.page === "graph"
 *   ? sca.controller.router.parsedUrl.flow
 *   : "Home";
 * ```
 */
export class RouterController
  extends RootController
  implements ParsedUrlProvider
{
  @field()
  private accessor _parsedUrl: MakeUrlInit;

  constructor() {
    super("Router", "router");

    // Parse initial URL and clear redirect flag if present
    const parsed = parseUrl(window.location.href);
    if ("redirectFromLanding" in parsed) {
      parsed.redirectFromLanding = false;
    }

    // Canonicalize URL if needed
    const canonicalized = makeUrl(parsed);
    if (window.location.href !== canonicalized) {
      window.history.replaceState(null, "", canonicalized);
    }

    this._parsedUrl = parsed;
  }

  /**
   * The current parsed URL state.
   */
  get parsedUrl(): MakeUrlInit {
    return this._parsedUrl;
  }

  /**
   * Navigate to a new URL.
   *
   * Updates the browser history and the reactive `parsedUrl` state.
   * If the URL matches the current location, this is a no-op.
   *
   * @param init - The URL configuration to navigate to
   */
  go(init: MakeUrlInit) {
    const url = makeUrl(init);
    if (url !== window.location.href) {
      window.history.pushState(null, "", url);
      this.#updateParsedUrl();
    }
  }

  /**
   * Trigger initial URL change handling.
   *
   * Should be called once after the controller is wired up and triggers
   * are registered. This emulates the legacy `Router.init()` behavior.
   */
  init() {
    this.#updateParsedUrl();
  }

  /**
   * Update the parsed URL from the current window location.
   *
   * Called internally after navigation or popstate events.
   */
  updateFromCurrentUrl() {
    this.#updateParsedUrl();
  }

  /**
   * Remove all flow and tab parameters from the current URL.
   *
   * Used when closing a board to return to a clean home URL.
   */
  clearFlowParameters() {
    const pageUrl = new URL(window.location.href);
    const paramsToDelete = [...pageUrl.searchParams]
      .filter(([id]) => id.startsWith("tab") || id.startsWith("flow"))
      .map(([id]) => id);

    for (const id of paramsToDelete) {
      pageUrl.searchParams.delete(id);
    }

    window.history.replaceState(null, "", pageUrl);
  }

  #updateParsedUrl() {
    this._parsedUrl = parseUrl(window.location.href);
  }
}
