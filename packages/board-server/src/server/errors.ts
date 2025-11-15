/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO expressify

import type { Response } from "express";
import { ServerResponse } from "http";

export const serverError = (res: ServerResponse, error: string) => {
  res.writeHead(500, "Server Error");
  res.end(error);
};

export const badRequest = (res: ServerResponse, error: string) => {
  res.writeHead(400, "Bad Request");
  res.end(error || "Bad Request");
};

export function unauthorized(res: Response): void {
  res.sendStatus(401);
}
