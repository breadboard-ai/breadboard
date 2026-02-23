/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { extractGoogleDriveFileId } from "@breadboard-ai/utils/google-drive/utils.js";
import {
  BaseUrlInit,
  GraphUrlInit,
  HomeUrlInit,
  LandingUrlInit,
  MakeUrlInit,
  OpenUrlInit,
} from "../../sca/types.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";

export function devUrlParams(): Required<BaseUrlInit>["dev"] {
  // TODO(aomarks) Add a flag so that we only allow these in dev.
  return parseUrl(window.location.href).dev ?? {};
}

const FLOW = "flow";
const TAB0 = "tab0";
const MODE = "mode";
const LITE = "lite" as const;
const NEW = "new";
const REMIX = "remix";
const COLOR_SCHEME = "color-scheme" as const;
const COLOR_SCHEME_LIGHT = "light" as const;
const COLOR_SCHEME_DARK = "dark" as const;
const RESULTS = "results";
const GEO_RESTRICTION = "geo-restriction";
const MISSING_SCOPES = "missing-scopes";
const RESOURCE_KEY = "resourcekey";
export const OAUTH_REDIRECT = "oauth_redirect";
const DEV_PREFIX = "dev-";

/**
 * Generate a URL for a page on the Breadboard Visual Editor.
 */
export function makeUrl(
  init: MakeUrlInit,
  base: string | URL = window.location.href,
  enableNewUrlScheme = CLIENT_DEPLOYMENT_CONFIG.ENABLE_NEW_URL_SCHEME
): string {
  const baseOrigin =
    typeof base === "string" ? new URL(base).origin : base.origin;
  const url = new URL(baseOrigin);
  const { page } = init;
  if (init?.oauthRedirect) {
    url.searchParams.set(OAUTH_REDIRECT, init.oauthRedirect);
  }
  if (page === "home") {
    url.pathname = "/";
    if (init.lite) {
      url.searchParams.set(LITE, init.lite === true ? "true" : "false");
    }
    if (
      init.colorScheme === COLOR_SCHEME_LIGHT ||
      init.colorScheme === COLOR_SCHEME_DARK
    ) {
      url.searchParams.set(
        COLOR_SCHEME,
        init.colorScheme === COLOR_SCHEME_LIGHT
          ? COLOR_SCHEME_LIGHT
          : COLOR_SCHEME_DARK
      );
    }
    if (init.new) {
      url.searchParams.set(NEW, init.new === true ? "true" : "false");
    }
  } else if (page === "graph") {
    if (!enableNewUrlScheme) {
      url.searchParams.set(FLOW, init.flow);
    }
    if (init.resourceKey) {
      url.searchParams.set(RESOURCE_KEY, init.resourceKey);
    }
    if (init.remix) {
      url.searchParams.set(REMIX, init.remix ? "true" : "false");
    }
    if (init.results) {
      url.searchParams.set(RESULTS, init.results);
    }
    if (init.lite) {
      url.searchParams.set(LITE, init.lite === true ? "true" : "false");
    }
    if (
      init.colorScheme === COLOR_SCHEME_LIGHT ||
      init.colorScheme === COLOR_SCHEME_DARK
    ) {
      url.searchParams.set(
        COLOR_SCHEME,
        init.colorScheme === COLOR_SCHEME_LIGHT
          ? COLOR_SCHEME_LIGHT
          : COLOR_SCHEME_DARK
      );
    }
    if (!enableNewUrlScheme) {
      url.searchParams.set(MODE, init.mode);
    } else {
      const driveId = extractGoogleDriveFileId(init.flow);
      if (!driveId) {
        throw new Error("unsupported graph id " + init.flow);
      }
      if (init.mode === "app") {
        url.pathname = "app/" + encodeURIComponent(driveId);
      } else if (init.mode === "canvas") {
        url.pathname = "edit/" + encodeURIComponent(driveId);
      } else {
        init.mode satisfies never;
        throw new Error("unsupported mode " + init.mode);
      }
    }
  } else if (page === "landing") {
    url.pathname = "landing/";
    if (init.geoRestriction) {
      url.searchParams.set(GEO_RESTRICTION, "true");
    }
    if (init.missingScopes) {
      url.searchParams.set(MISSING_SCOPES, "true");
    }
    if (init.lite) {
      url.searchParams.set(LITE, init.lite === true ? "true" : "false");
    }
    if (
      init.colorScheme === COLOR_SCHEME_LIGHT ||
      init.colorScheme === COLOR_SCHEME_DARK
    ) {
      url.searchParams.set(
        COLOR_SCHEME,
        init.colorScheme === COLOR_SCHEME_LIGHT
          ? COLOR_SCHEME_LIGHT
          : COLOR_SCHEME_DARK
      );
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
  } else if (page === "open") {
    url.pathname = `open/${encodeURIComponent(init.fileId)}`;
    if (init.resourceKey) {
      url.searchParams.set(RESOURCE_KEY, init.resourceKey);
    }
  } else {
    page satisfies never;
    throw new Error(
      `unhandled page ${JSON.stringify(page)} from ${JSON.stringify(init)}`
    );
  }
  if (init.dev) {
    for (const [key, val] of Object.entries(
      init.dev as Record<string, string>
    )) {
      url.searchParams.set(DEV_PREFIX + key, val);
    }
  }
  if (init.guestPrefixed) {
    url.pathname = "/_app" + url.pathname;
  }
  return (
    url.href
      // A little extra cleanup. The URL class escapes search params very
      // strictly, and does not allow bare search params.
      .replace("drive%3A%2F", "drive:/")
  );
}

/**
 * Parse a Breadboard Visual Editor URL into a strongly-typed object.
 */
export function parseUrl(url: string | URL): MakeUrlInit {
  if (typeof url === "string") {
    url = new URL(url);
  }
  let dev: BaseUrlInit["dev"];
  const oauthRedirect = url.searchParams.get(OAUTH_REDIRECT);
  for (const [key, val] of url.searchParams) {
    if (key.startsWith(DEV_PREFIX)) {
      dev ??= {};
      const keySansPrefix = key.slice(DEV_PREFIX.length);
      // Note while dev has strong types to make sure we're accessing the right
      // properties, we actually don't care about them when parsing; anything
      // with a "dev-" prefix will get preserved.
      (dev as Record<string, string>)[keySansPrefix] = val;
    }
  }
  const guestPrefixed = url.pathname.startsWith("/_app/");
  const pathname = guestPrefixed
    ? url.pathname.slice("/_app".length)
    : url.pathname;
  if (pathname === "/landing/") {
    // See note in `makeUrl` above about redirect URLs.
    const redirectUrl = new URL(url);
    redirectUrl.pathname = "/";
    const redirectParsed = parseUrl(redirectUrl);
    const landing: LandingUrlInit = {
      page: "landing",
      redirect:
        redirectParsed.page === "landing" || redirectParsed.page === "open"
          ? {
              page: "home",
              redirectFromLanding: true,
              guestPrefixed: true,
            }
          : {
              ...redirectParsed,
              redirectFromLanding: true,
              guestPrefixed: true,
            },
      guestPrefixed,
    };
    if (url.searchParams.has(GEO_RESTRICTION)) {
      landing.geoRestriction = true;
    }
    if (url.searchParams.has(MISSING_SCOPES)) {
      landing.missingScopes = true;
    }
    if (oauthRedirect) {
      landing.oauthRedirect = oauthRedirect;
    }
    if (dev) {
      landing.dev = dev;
    }
    return landing;
  } else if (pathname.startsWith("/open/")) {
    const open: OpenUrlInit = {
      page: "open",
      fileId: pathname.slice("/open/".length),
      resourceKey: url.searchParams.get(RESOURCE_KEY) ?? undefined,
      guestPrefixed,
    };
    return open;
  } else {
    let flow =
      url.searchParams.get(FLOW) ||
      url.searchParams.get(TAB0) ||
      (pathname.startsWith("/app/") && pathname.slice("/app/".length)) ||
      (pathname.startsWith("/edit/") && pathname.slice("/edit/".length));
    if (
      flow &&
      !flow.startsWith("drive:/") &&
      (pathname.startsWith("/app/") || pathname.startsWith("/edit/"))
    ) {
      flow = "drive:/" + flow;
    }
    if (!flow) {
      const home: HomeUrlInit = {
        page: "home",
        lite: url.searchParams.get("lite") === "true",
        colorScheme:
          url.searchParams.get("color-scheme") === COLOR_SCHEME_LIGHT
            ? COLOR_SCHEME_LIGHT
            : url.searchParams.get("color-scheme") === COLOR_SCHEME_DARK
              ? COLOR_SCHEME_DARK
              : undefined,
        new: url.searchParams.get(NEW) === "true",
        guestPrefixed,
      };
      if (dev) {
        home.dev = dev;
      }
      if (oauthRedirect) {
        home.oauthRedirect = oauthRedirect;
      }
      return home;
    }
    const mode =
      url.searchParams.get(MODE) === "app" || pathname.startsWith("/app/")
        ? "app"
        : "canvas";
    const graph: GraphUrlInit = {
      page: "graph",
      mode,
      lite: url.searchParams.get(LITE) === "true",
      colorScheme:
        url.searchParams.get("color-scheme") === COLOR_SCHEME_LIGHT
          ? COLOR_SCHEME_LIGHT
          : url.searchParams.get("color-scheme") === COLOR_SCHEME_DARK
            ? COLOR_SCHEME_DARK
            : undefined,
      flow,
      resourceKey: url.searchParams.get(RESOURCE_KEY) ?? undefined,
      guestPrefixed,
    };
    const remix = url.searchParams.get(REMIX);
    if (remix) {
      graph.remix = remix === "true";
    }
    const results = url.searchParams.get(RESULTS);
    if (results) {
      graph.results = results;
    }
    if (dev) {
      graph.dev = dev;
    }
    if (oauthRedirect) {
      graph.oauthRedirect = oauthRedirect;
    }
    return graph;
  }
}
