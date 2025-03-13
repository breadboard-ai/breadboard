/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from "express";

import { requireAccessToken, requireAuth } from "../auth.js";
import type { ServerConfig } from "../config.js";

import listBoards from "./list.js";
import createBoard from "./create.js";
import getBoard from "./get.js";
import post from "./post.js";
import invokeBoard from "./invoke.js";
import describeBoard from "./describe.js";
import inviteList from "./invite-list.js";
import inviteUpdate from "./invite-update.js";
import runBoard from "./run.js";
import handleAssetsDriveRequest from "./assets-drive.js";
import { loadBoard, parseBoardId } from "./loader.js";

export function serveBoardsAPI(serverConfig: ServerConfig): Router {
  const router = Router();

  router.get("/", requireAuth(), listBoards);
  router.post("/", requireAuth(), createBoard);

  // Suffixed routes. These routes rely on special suffixes attached to the
  // board name.
  //
  // The actual board name is found by replacing the suffix with ".json". So
  // these routes will only work if the board name ends in ".json"
  //
  // TODO: #4824 - Stop doing this. Turn down support for suffixed routes
  router.post(
    "/@:user/:name.api/invoke",
    parseBoardId({ addJsonSuffix: true }),
    async (req, res) => invokeBoard(serverConfig, req, res)
  );
  router.post(
    "/@:user/:name.api/run",
    parseBoardId({ addJsonSuffix: true }),
    async (req, res) => runBoard(serverConfig, req, res)
  );
  router.post(
    "/@:user/:name.api/describe",
    parseBoardId({ addJsonSuffix: true }),
    describeBoard
  );
  router.get(
    "/@:user/:name.invite",
    requireAuth(),
    parseBoardId({ addJsonSuffix: true }),
    inviteList
  );
  router.post(
    "/@:user/:name.invite",
    requireAuth(),
    parseBoardId({ addJsonSuffix: true }),
    inviteUpdate
  );

  // Non suffixed routes. These routes treat the board name as an opaque
  // identifier and do not try to deconstruct it. The board is loaded from
  // storage exactly as named. This is the way.
  router.get("/@:user/:name", loadBoard(), getBoard);
  router.post("/@:user/:name", requireAuth(), parseBoardId(), post);

  router.post("/@:user/:name/invoke", parseBoardId(), async (req, res) =>
    invokeBoard(serverConfig, req, res)
  );
  router.post("/@:user/:name/run", parseBoardId(), async (req, res) =>
    runBoard(serverConfig, req, res)
  );
  router.post("/@:user/:name/describe", parseBoardId(), describeBoard);
  router.get(
    "/@:user/:name/invites",
    requireAuth(),
    parseBoardId(),
    inviteList
  );
  router.post(
    "/@:user/:name/invites",
    requireAuth(),
    parseBoardId(),
    inviteUpdate
  );

  router.post(
    "/@:user/:name/assets/drive/:driveId",
    requireAccessToken(),
    parseBoardId(),
    handleAssetsDriveRequest
  );

  return router;
}
