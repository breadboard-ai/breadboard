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
    "'wasm-unsafe-eval'",
    "www.google-analytics.com",
    "www.googletagmanager.com",
    "apis.google.com",
  ],
  ["img-src"]: [
    "'self'",
    "data:",
    "*.googleusercontent.com",
    "*.gstatic.com",
    "*.ytimg.com",
  ],
  ["style-src"]: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
  ["font-src"]: ["fonts.gstatic.com"],
  ["connect-src"]: [
    "'self'",
    "www.google-analytics.com",
    "www.googleapis.com/drive/",
    "www.googleapis.com/upload/drive/",
    "play.google.com/log",
  ],
  ["frame-src"]: ["docs.google.com", "drive.google.com", "www.youtube.com"],
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
