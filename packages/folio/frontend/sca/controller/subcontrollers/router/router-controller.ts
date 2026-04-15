/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FolioUrlInit, ParsedUrlProvider } from "../../../types.js";
import { makeUrl, parseUrl } from "../../../../ui/navigation/urls.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * Controller managing URL state and browser navigation.
 *
 * All URL state is reactive via the `@field` decorator, enabling efficient
 * reactivity across the application.
 *
 * **Responsibilities:**
 * - Maintains the current parsed URL state (`parsedUrl`)
 * - Provides navigation via `go()` method
 * - Handles URL canonicalization on initialization
 *
 * @example
 * ```typescript
 * // Navigate to an agent
 * sca.controller.router.go({
 *   page: "agent",
 *   agentId: "my-agent",
 * });
 *
 * // React to URL changes
 * const title = sca.controller.router.parsedUrl.page === "agent"
 *   ? sca.controller.router.parsedUrl.agentId
 *   : "Home";
 * ```
 */
export class RouterController
  extends RootController
  implements ParsedUrlProvider
{
  @field()
  private accessor _parsedUrl: FolioUrlInit;

  @field()
  accessor urlError: string | null = null;

  constructor() {
    super("Router", "router");

    const parsed = parseUrl(window.location.href);

    // Canonicalize URL if needed. If makeUrl rejects the parsed state,
    // fall back to home and record the error for UI display.
    try {
      const canonicalized = makeUrl(parsed);
      if (window.location.href !== canonicalized) {
        window.history.replaceState(null, "", canonicalized);
      }
      this._parsedUrl = parsed;
    } catch (e) {
      const home = parseUrl(new URL(window.location.origin));
      window.history.replaceState(null, "", window.location.origin);
      this._parsedUrl = home;
      this.urlError = e instanceof Error ? e.message : String(e);
    }
  }

  /**
   * The current parsed URL state.
   */
  get parsedUrl(): FolioUrlInit {
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
  go(init: FolioUrlInit) {
    const url = makeUrl(init);
    if (url !== window.location.href) {
      window.history.pushState(null, "", url);
      this.#updateParsedUrl();
    }
  }

  /**
   * Navigate away from the current SPA entirely.
   *
   * Use this for navigations that require a full page load (e.g., going to the
   * landing page, which is a separate HTML entrypoint). Unlike `go()`, this
   * does NOT use `pushState` — it triggers a hard browser navigation.
   */
  navigateAway(init: FolioUrlInit) {
    window.location.href = makeUrl(init);
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

  #updateParsedUrl() {
    this._parsedUrl = parseUrl(window.location.href);
  }
}
