/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServerResponse } from "http";

export const serverError = (res: ServerResponse, error: string) => {
  res.writeHead(500, "Server Error");
  res.end(error);
};

export const badRequest = (res: ServerResponse, error: string) => {
  res.writeHead(400, "Bad Request");
  res.end(error || "Bad Request");
};

export const methodNotAllowed = (res: ServerResponse, error: string) => {
  res.writeHead(405, "Method Not Allowed");
  res.end(error);
};

export const notFound = (res: ServerResponse, error: string) => {
  res.writeHead(404, "Page not found");
  res.end(error);
};

export const unauthorized = (res: ServerResponse, error: string) => {
  res.writeHead(401, "Unauthorized");
  res.end(error);
};
