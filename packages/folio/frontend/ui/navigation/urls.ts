/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BaseUrlInit, FolioUrlInit } from "../../sca/types.js";

export function devUrlParams(): Required<BaseUrlInit>["dev"] {
  return parseUrl(window.location.href).dev ?? {};
}

const COLOR_SCHEME = "color-scheme" as const;
const COLOR_SCHEME_LIGHT = "light" as const;
const COLOR_SCHEME_DARK = "dark" as const;

const AGENT_TASK_PATTERN = new URLPattern({
  pathname: "/agent/:agentId/task/:taskId",
});
const AGENT_PATTERN = new URLPattern({ pathname: "/agent/:agentId" });

export const OAUTH_REDIRECT = "oauth_redirect";
const DEV_PREFIX = "dev-";

/**
 * Generate a URL for a page in Folio.
 */
export function makeUrl(
  init: FolioUrlInit,
  base: string | URL = window.location.href
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
  } else if (page === "agent") {
    url.pathname = `agent/${encodeURIComponent(init.agentId)}`;
  } else if (page === "agent-task") {
    url.pathname = `agent/${encodeURIComponent(init.agentId)}/task/${encodeURIComponent(init.taskId)}`;
  } else {
    page satisfies never;
    throw new Error(
      `unhandled page ${JSON.stringify(page)} from ${JSON.stringify(init)}`
    );
  }

  if (
    init.colorScheme === COLOR_SCHEME_LIGHT ||
    init.colorScheme === COLOR_SCHEME_DARK
  ) {
    url.searchParams.set(COLOR_SCHEME, init.colorScheme);
  }

  if (init.dev) {
    for (const [key, val] of Object.entries(
      init.dev as Record<string, string>
    )) {
      url.searchParams.set(DEV_PREFIX + key, val);
    }
  }

  return url.href;
}

/**
 * Parse a Folio URL into a strongly-typed object.
 */
export function parseUrl(url: string | URL): FolioUrlInit {
  if (typeof url === "string") {
    url = new URL(url);
  }

  let dev: BaseUrlInit["dev"];
  const oauthRedirect = url.searchParams.get(OAUTH_REDIRECT) ?? undefined;

  for (const [key, val] of url.searchParams) {
    if (key.startsWith(DEV_PREFIX)) {
      dev ??= {};
      const keySansPrefix = key.slice(DEV_PREFIX.length);
      (dev as Record<string, string>)[keySansPrefix] = val;
    }
  }

  const cs = url.searchParams.get(COLOR_SCHEME);
  const colorScheme =
    cs === COLOR_SCHEME_LIGHT || cs === COLOR_SCHEME_DARK ? cs : undefined;

  const base = { dev, colorScheme, oauthRedirect } as const;

  const agentTaskMatch = AGENT_TASK_PATTERN.exec({ pathname: url.pathname });
  if (agentTaskMatch) {
    const { agentId = "", taskId = "" } = agentTaskMatch.pathname.groups;
    return { ...base, page: "agent-task", agentId, taskId };
  }

  const agentMatch = AGENT_PATTERN.exec({ pathname: url.pathname });
  if (agentMatch) {
    const { agentId = "" } = agentMatch.pathname.groups;
    return { ...base, page: "agent", agentId };
  }

  return { ...base, page: "home" };
}
