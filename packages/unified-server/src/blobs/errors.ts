/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO expressify

import { ServerResponse } from "http";

export const badRequest = (res: ServerResponse, error: string) => {
  res.writeHead(400, "Bad Request");
  res.end(error || "Bad Request");
};
