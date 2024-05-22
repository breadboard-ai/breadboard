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

export const notFound = (res: ServerResponse, error: string) => {
  res.writeHead(404, "Page not found");
  res.end(error);
};
