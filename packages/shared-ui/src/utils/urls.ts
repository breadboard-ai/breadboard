/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type VisualEditorMode } from "../types/types.js";

export type MakeUrlInit = HomeUrlInit | GraphInit | LandingUrlInit;

export interface HomeUrlInit {
  page: "home";
  mode?: VisualEditorMode;
  redirectFromLanding?: boolean;
}

export interface GraphInit {
  page: "graph";
  mode: VisualEditorMode;
  flow: string;
  resourceKey: string | undefined;
  results?: string;
  shared?: boolean;
  redirectFromLanding?: boolean;
}

export interface LandingUrlInit {
  page: "landing";
  redirect: MakeUrlInit;
  oauthRedirect?: string;
  missingScopes?: boolean;
  geoRestriction?: boolean;
}

const FLOW = "flow";
const TAB0 = "tab0";
const MODE = "mode";
const MODE_APP = "app" as const;
const MODE_CANVAS = "canvas" as const;
type MODE_VALUES = typeof MODE_APP | typeof MODE_CANVAS;
const RESULTS = "results";
const SHARED = "shared";
const GEO_RESTRICTION = "geo-restriction";
const MISSING_SCOPES = "missing-scopes";
const RESOURCE_KEY = "resourcekey";
const OAUTH_REDIRECT = "oauth_redirect";

/**
 * Generate a URL for a page on the Breadboard Visual Editor.
 */
export function makeUrl(
  init: MakeUrlInit,
  base: string | URL = window.location.href
): string {
  const baseOrigin =
    typeof base === "string" ? new URL(base).origin : base.origin;
  const url = new URL(baseOrigin);
  const { page } = init;
  if (page === "home") {
    url.pathname = "/";
    url.searchParams.set(MODE, init.mode ?? MODE_CANVAS);
  } else if (page === "graph") {
    url.searchParams.set(FLOW, init.flow);
    if (init.resourceKey) {
      url.searchParams.set(RESOURCE_KEY, init.resourceKey);
    }
    if (init.shared) {
      url.searchParams.set(SHARED, "");
    }
    if (init.results) {
      url.searchParams.set(RESULTS, init.results);
    }
    url.searchParams.set(MODE, init.mode);
  } else if (page === "landing") {
    url.pathname = "landing/";
    if (init.geoRestriction) {
      url.searchParams.set(GEO_RESTRICTION, "true");
    }
    if (init.missingScopes) {
      url.searchParams.set(MISSING_SCOPES, "true");
    }
    if (init.redirect.page === "graph") {
      // To encode the redirect URL, we just copy all the search params directly
      // onto the landing page URL, and then pick them off later. Note this
      // could be a little brittle if we add more pages, since we aren't
      // explicitly representing which page we're redirecting to.
      const redirectUrl = new URL(makeUrl(init.redirect, base));
      for (const [redirectParam, redirectValue] of redirectUrl.searchParams) {
        url.searchParams.set(redirectParam, redirectValue);
      }
    }
    if (init.oauthRedirect) {
      url.searchParams.set(OAUTH_REDIRECT, init.oauthRedirect);
    }
  } else {
    page satisfies never;
    throw new Error(
      `unhandled page ${JSON.stringify(page)} from ${JSON.stringify(init)}`
    );
  }
  return (
    url.href
      // A little extra cleanup. The URL class escapes search params very
      // strictly, and does not allow bare search params.
      .replace("drive%3A%2F", "drive:/")
      .replace(/[?&]shared=/, "&shared")
  );
}

/**
 * Parse a Breadboard Visual Editor URL into a strongly-typed object.
 */
export function parseUrl(url: string | URL): MakeUrlInit {
  if (typeof url === "string") {
    url = new URL(url);
  }
  if (url.pathname === "/landing/") {
    // See note in `makeUrl` above about redirect URLs.
    const redirectUrl = new URL(url);
    redirectUrl.pathname = "/";
    const redirectParsed = parseUrl(redirectUrl);
    const landing: LandingUrlInit = {
      page: "landing",
      redirect:
        redirectParsed.page === "landing"
          ? { page: "home", redirectFromLanding: true }
          : { ...redirectParsed, redirectFromLanding: true },
    };
    if (url.searchParams.has(GEO_RESTRICTION)) {
      landing.geoRestriction = true;
    }
    if (url.searchParams.has(MISSING_SCOPES)) {
      landing.missingScopes = true;
    }
    const oauthRedirect = url.searchParams.get(OAUTH_REDIRECT);
    if (oauthRedirect) {
      landing.oauthRedirect = oauthRedirect;
    }
    return landing;
  } else {
    const flow = url.searchParams.get(FLOW) || url.searchParams.get(TAB0);
    if (!flow) {
      return {
        page: "home",
        mode:
          url.searchParams.get("mode") === MODE_APP ? MODE_APP : MODE_CANVAS,
      };
    }
    const graph: GraphInit = {
      page: "graph",
      mode: url.searchParams.get(MODE) === "app" ? "app" : "canvas",
      flow: flow,
      resourceKey: url.searchParams.get(RESOURCE_KEY) ?? undefined,
    };
    const results = url.searchParams.get(RESULTS);
    if (results) {
      graph.results = results;
    }
    if (url.searchParams.has(SHARED)) {
      graph.shared = true;
    }
    return graph;
  }
}
