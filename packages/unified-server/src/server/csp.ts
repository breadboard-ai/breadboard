/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as flags from "./flags.js";

import type { Handler, NextFunction, Request, Response } from "express";

const CSP_CONFIG = {
  ["default-src"]: ["'none'"],
  ["script-src"]: [
    "'self'",
    "'unsafe-inline'",
    "'wasm-unsafe-eval'",
    "https://apis.google.com",
    "https://cdn.tailwindcss.com",
    "https://unpkg.com",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com",
    "https://support.google.com",
    "https://www.google-analytics.com",
    "https://www.googletagmanager.com",
    "https://www.gstatic.com",
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
    "https://*.google-analytics.com",
    "https://*.google.com",
    "https://*.googleapis.com/",
    "https://oauth2.googleapis.com/tokeninfo",
  ],
  ["frame-src"]: [
    "https://docs.google.com",
    "https://*.googleapis.com",
    "https://drive.google.com",
    "https://www.google.com",
    "https://www.youtube.com",
    "https://feedback-pa.clients6.google.com",
  ],
  ["media-src"]: ["'self'", "blob:", "data:"],
  ["base-uri"]: ["'none'"],
};

const CSP_HEADER_NAME = "Content-Security-Policy";

/** https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP */
export function makeCspHandler(): Handler {
  const cspConfig = structuredClone(CSP_CONFIG);
  if (flags.BACKEND_API_ENDPOINT) {
    cspConfig["connect-src"].push(flags.BACKEND_API_ENDPOINT);
  }
  const cspHeaderValue = Object.entries(cspConfig)
    .map(([key, vals]) => `${key} ${vals.join(" ")}`)
    .join(";");

  return (_: Request, res: Response, next: NextFunction) => {
    res.setHeader(CSP_HEADER_NAME, cspHeaderValue);
    next();
  };
}
