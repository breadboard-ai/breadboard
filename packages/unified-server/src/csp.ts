/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as flags from "./flags.js";

import type { Handler, NextFunction, Request, Response } from "express";

export const FALLBACK_CSP = {
  ["base-uri"]: ["'none'"],
  ["default-src"]: ["'none'"],
  ["form-action"]: ["'none'"],
  ["frame-ancestors"]: ["'none'"],
  ["require-trusted-types-for"]: ["'script'"],
  ["trusted-types"]: ["'none'"],
};

export const OAUTH_REDIRECT_CSP = {
  ["base-uri"]: ["'none'"],
  ["connect-src"]: ["'self'"],
  ["default-src"]: ["'none'"],
  ["font-src"]: [
    // Google Fonts seems to be required by Chrome itself. Without it, despite
    // not rendering any text in the shell, the console shows lots of CSP
    // violations.
    "https://fonts.gstatic.com",
  ],
  ["form-action"]: ["'none'"],
  ["frame-ancestors"]: noneIfEmpty(flags.ALLOWED_REDIRECT_ORIGINS),
  ["script-src"]: ["'self'"],
  ["require-trusted-types-for"]: ["'script'"],
  ["trusted-types"]: ["'none'"],
};

export const SHELL_CSP = {
  ["base-uri"]: ["'none'"],
  ["connect-src"]: [
    "'self'",
    "https://*.google.com",
    "https://*.googleapis.com",
    flags.BACKEND_API_ENDPOINT,
    // TODO(aomarks) Remove this after we have eliminated all credentialed RPCs
    // to the frontend server.
    flags.SHELL_GUEST_ORIGIN,
  ],
  ["default-src"]: ["'none'"],
  ["font-src"]: ["https://fonts.gstatic.com"],
  ["form-action"]: ["'none'"],
  ["frame-ancestors"]: noneIfEmpty(flags.ALLOWED_REDIRECT_ORIGINS),
  ["frame-src"]: [
    "https://docs.google.com",
    "https://drive.google.com",
    flags.SHELL_GUEST_ORIGIN,
  ],
  ["img-src"]: ["https://*.gstatic.com"],
  ["script-src"]: ["'self'", "https://apis.google.com"],
  ["style-src"]: ["'unsafe-inline'"],
  ["require-trusted-types-for"]: ["'script'"],
  ["trusted-types"]: ["opal-gapi-url", "gapi#gapi", "goog#html"],
};

export const MAIN_APP_CSP = {
  ["default-src"]: ["'none'"],
  ["script-src"]: [
    "'self'",
    "https://support.google.com",
    "https://www.google-analytics.com",
    "https://www.google.com", // Feedback
    "https://www.googletagmanager.com",
    "https://www.gstatic.com",
    ...(flags.SHELL_ENABLED ? [] : ["https://apis.google.com"]),
  ],
  ["img-src"]: [
    "'self'",
    "blob:",
    "data:",
    "https://*.google.com",
    "https://*.googleusercontent.com",
    "https://raw.githubusercontent.com",
    "https://*.gstatic.com",
    "https://*.ytimg.com",
    "https://img.youtube.com",
  ],
  ["style-src"]: [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://gstatic.com",
    "https://www.gstatic.com",
  ],
  ["font-src"]: ["https://fonts.gstatic.com"],
  ["connect-src"]: [
    "'self'",
    "data:",
    "https://*.google.com",
    "https://*.google-analytics.com",
    ...(flags.SHELL_ENABLED
      ? []
      : [
          "https://*.googleapis.com",
          flags.BACKEND_API_ENDPOINT,
          flags.SHELL_GUEST_ORIGIN,
        ]),
  ],
  ["frame-src"]: [
    "'self'",
    "https://docs.google.com",
    "https://*.googleapis.com",
    "https://drive.google.com",
    "https://www.google.com",
    "https://www.youtube.com",
    "https://feedback-pa.clients6.google.com",
    "https://accounts.google.com",
  ],
  ["frame-ancestors"]: noneIfEmpty([
    // Note that frame-ancestors applies recursively. If A iframes B iframes C,
    // then C must allow both B and A.
    ...flags.ALLOWED_REDIRECT_ORIGINS,
    ...(flags.SHELL_ENABLED ? flags.SHELL_HOST_ORIGINS : []),
  ]),
  ["media-src"]: ["'self'", "blob:", "data:"],
  ["base-uri"]: ["'none'"],
  ["require-trusted-types-for"]: ["'script'"],
  ["trusted-types"]: [
    "lit-html",
    "opal-analytics-url",
    "opal-chiclet-html",
    "opal-gapi-url",
  ],
};

export const GENERATED_APP_CSP = {
  ["default-src"]: ["'none'"],
  ["script-src"]: [
    "'self'",
    "'unsafe-inline'",
    "https://cdn.tailwindcss.com",
    "https://unpkg.com",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com",
  ],
  ["img-src"]: ["blob:", "data:"],
  ["style-src"]: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  ["font-src"]: ["https://fonts.gstatic.com"],
  ["connect-src"]: ["'self'"],
  ["frame-src"]: ["'none'"],
  ["frame-ancestors"]: [
    "'self'",
    // Note that frame-ancestors applies recursively. If A iframes B iframes C,
    // then C must allow both B and A.
    ...flags.ALLOWED_REDIRECT_ORIGINS,
    ...(flags.SHELL_ENABLED ? flags.SHELL_HOST_ORIGINS : []),
  ],
  ["media-src"]: ["blob:", "data:"],
  ["base-uri"]: ["'none'"],
};

function noneIfEmpty(directives: string[]): string[] {
  return directives.filter((directive) => directive.trim()).length === 0
    ? ["'none'"]
    : directives;
}

const CSP_HEADER_NAME = "Content-Security-Policy";

/** https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP */
export function makeCspHandler(csp: Record<string, string[]>): Handler {
  const cspHeaderValue = Object.entries(csp)
    .map(([key, vals]) => `${key} ${vals.join(" ")}`)
    .join(";");

  return (_: Request, res: Response, next: NextFunction) => {
    res.setHeader(CSP_HEADER_NAME, cspHeaderValue);
    next();
  };
}
