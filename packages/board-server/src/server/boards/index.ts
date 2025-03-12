/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Request,
  type Response,
  type NextFunction,
  Router,
} from "express";

import { requireAccessToken, requireAuth } from "../auth.js";
import type { ServerConfig } from "../config.js";
import { cors, corsAll } from "../cors.js";
import type { BoardId } from "../types.js";

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
import { loadBoard } from "./loader.js";

export function serveBoardsAPI(serverConfig: ServerConfig): Router {
  const router = Router();

  router.use("/", cors(serverConfig.allowedOrigins));
  router.use("/@:user/:name.json", corsAll);
  router.use("/@:user/:name.json", cors(serverConfig.allowedOrigins));
  router.use("/@:user/:name.api/invoke", corsAll);
  router.use("/@:user/:name.api/run", corsAll);
  router.use("/@:user/:name.api/describe", corsAll);
  router.use("/@:user/:name.invite", cors(serverConfig.allowedOrigins));
  router.use(
    "/@:user/:name/assets/drive/:driveId",
    cors(serverConfig.allowedOrigins)
  );

  router.get("/", requireAuth(), listBoards);
  router.post("/", requireAuth(), createBoard);

  router.use("/@:user/:name.(json|api|app|invite)", getBoardId);

  router.post("/@:user/:name.json", requireAuth(), post);

  router.post("/@:user/:name.api/invoke", async (req, res) =>
    invokeBoard(serverConfig, req, res)
  );

  router.post("/@:user/:name.api/run", async (req, res) =>
    runBoard(serverConfig, req, res)
  );

  router.post("/@:user/:name.api/describe", describeBoard);

  router.get("/@:user/:name.invite", requireAuth(), inviteList);
  router.post("/@:user/:name.invite", requireAuth(), inviteUpdate);

  router.get("/@:user/:name", loadBoard(), getBoard);

  router.post(
    "/@:user/:name/assets/drive/:driveId",
    requireAccessToken(),
    handleAssetsDriveRequest
  );

  return router;
}

function getBoardId(req: Request, res: Response, next: NextFunction) {
  const { user = "", name = "" } = req.params;
  let boardId: BoardId = {
    user,
    name: name + ".json",
    fullPath: `@${user}/${name}.json`,
  };
  res.locals.boardId = boardId;
  next();
}
