/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO: Remove this entire file and remote board server machinery.

import { ConnectionArgs } from "./types";

export { getSigninToken, createRequest };

function createRequest(
  url: URL | string,
  args: ConnectionArgs | null,
  method: string,
  body?: unknown
): Request {
  if (typeof url === "string") {
    url = new URL(url, window.location.href);
  } else {
    url = new URL(url);
  }
  if (args) {
    if ("key" in args) {
      if (args.key) {
        url.searchParams.set("API_KEY", args.key);
      }
      return new Request(url.href, {
        method,
        credentials: "include",
        body: JSON.stringify(body),
      });
    } else if ("token" in args) {
      return new Request(url, {
        method,
        credentials: "include",
        body: JSON.stringify(body),
      });
    }
  }
  return new Request(url.href, {
    method,
    credentials: "include",
    body: JSON.stringify(body),
  });
}

async function getSigninToken(): Promise<string | undefined> {
  console.warn(
    "RemoteBoardServer getSigninToken called: this is likely a bug in code."
  );
  return undefined;
}
