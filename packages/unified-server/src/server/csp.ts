/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServerDeploymentConfiguration } from "@breadboard-ai/types/deployment-configuration.js";
import type { Handler, NextFunction, Request, Response } from "express";

const CSP_CONFIG = {
  ["default-src"]: ["'none'"],
  ["script-src"]: [
    "'self'",
    "'unsafe-inline'",
    "'wasm-unsafe-eval'",
    "https://www.google-analytics.com",
    "https://www.googletagmanager.com",
    "https://apis.google.com",
    "https://cdn.tailwindcss.com",
  ],
  ["img-src"]: [
    "'self'",
    "data:",
    "https://*.google.com",
    "https://*.googleusercontent.com",
    "https://*.gstatic.com",
    "https://*.ytimg.com",
  ],
  ["style-src"]: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  ["font-src"]: ["https://fonts.gstatic.com"],
  ["connect-src"]: [
    "'self'",
    "https://play.google.com/log",
    "https://www.google-analytics.com",
    "https://www.googleapis.com/drive/",
    "https://www.googleapis.com/upload/drive/",
  ],
  ["frame-src"]: [
    "https://docs.google.com",
    "https://drive.google.com",
    "https://www.youtube.com",
  ],
  ["object-src"]: ["'none'"],
  ["base-uri"]: ["'none'"],
};

const CSP_HEADER_NAME = "Content-Security-Policy";

/** https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP */
export function makeCspHandler(
  serverConfig: ServerDeploymentConfiguration
): Handler {
  const cspConfig = structuredClone(CSP_CONFIG);
  if (serverConfig.BACKEND_API_ENDPOINT) {
    cspConfig["connect-src"].push(serverConfig.BACKEND_API_ENDPOINT);
  }
  const cspHeaderValue = Object.entries(cspConfig)
    .map(([key, vals]) => `${key} ${vals.join(" ")}`)
    .join(";");

  return (_: Request, res: Response, next: NextFunction) => {
    res.setHeader(CSP_HEADER_NAME, cspHeaderValue);
    next();
  };
}
