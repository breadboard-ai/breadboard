/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServerResponse } from "node:http";

export const internalServerError = (
  res: ServerResponse,
  message: string
): void => {
  res.writeHead(500, message);
  res.end(message);
};

export const notFound = (res: ServerResponse, message: string): void => {
  res.writeHead(404);
  res.end(message);
};

export const okJson = (res: ServerResponse, data: unknown): void => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
};

export const badRequestJson = (
  res: ServerResponse,
  data: unknown,
  options: {
    httpStatusCode?: number;
  } = {}
): void => {
  res.writeHead(options.httpStatusCode ?? 400, {
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(data, null, 2));
};
