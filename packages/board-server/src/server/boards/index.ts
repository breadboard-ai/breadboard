/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from "express";

import { requireAccessToken } from "../auth.js";

import { makeHandleAssetsDriveRequest } from "./assets-drive.js";
import type { ServerConfig } from "../config.js";

export function serveBoardsAPI({
  storageBucket,
  serverUrl,
}: ServerConfig): Router {
  const router = Router();

  const handleAssetsDriveRequest = makeHandleAssetsDriveRequest(
    storageBucket,
    serverUrl
  );

  router.post(
    "/@:_user/:_name/assets/drive/:driveId",
    requireAccessToken(),
    handleAssetsDriveRequest
  );

  return router;
}
