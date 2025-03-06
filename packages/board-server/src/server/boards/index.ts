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

import { getBody, serveFile, serveIndex } from "../common.js";
import type { ServerConfig } from "../config.js";
import { cors, corsAll } from "../cors.js";
import { getStore } from "../store.js";
import type { BoardId, PageMetadata } from "../types.js";

import listBoards from "./list.js";
import createBoard from "./create.js";
import getBoard from "./get.js";
import post from "./post.js";
import del from "./delete.js";
import invokeBoard from "./invoke.js";
import describeBoard from "./describe.js";
import inviteList from "./invite-list.js";
import inviteUpdate from "./invite-update.js";
import runBoard from "./run.js";
import handleAssetsDriveRequest from "./assets-drive.js";

function getMetadata(user: string, name: string) {
  return async (): Promise<PageMetadata | null> => {
    const store = getStore();
    const board = await store.get(user!, name!);
    try {
      return JSON.parse(board) as PageMetadata;
    } catch {
      return null;
    }
  };
}

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

  router.use("/@:user/:name.*", (req, res, next) => {
    const user = req.params["user"] ?? "";
    const name = (req.params["name"] ?? "") + ".json";
    let boardId: BoardId = {
      user,
      name,
      fullPath: `@${user}/${name}`,
    };
    res.locals.boardId = boardId;
    next();
  });

  router.get("/", listBoards);
  router.post("/", createBoard);

  router.use("/@:user/:name.(json|api|app)", getBoardId);

  router.get("/@:user/:name.json", getBoard);

  router.post("/@:user/:name.json", async (req, res) => {
    const body = await getBody(req);

    const maybeDelete = body as { delete: boolean };
    if (maybeDelete.delete === true) {
      await del(req, res);
    } else {
      await post(req, res, body);
    }
  });

  router.get("/@:user/:name.app", async (_req, res) => {
    const { user, name } = res.locals.boardId;
    // Serve the index.html file for the app.
    await serveIndex(serverConfig, res, getMetadata(user, name));
  });

  router.get("/@:user/:name.api", async (_req, res) => {
    await serveFile(serverConfig, res, "/api.html");
  });

  router.post("/@:user/:name.api/invoke", async (req, res) => {
    const { fullPath } = res.locals.boardId;
    const url = new URL(req.url, serverConfig.hostname);
    url.pathname = `boards/${fullPath}`;
    url.search = "";

    const body = await getBody(req);
    await invokeBoard(url, res, body);
  });

  router.post("/@:user/:name.api/run", async (req, res) => {
    const { fullPath } = res.locals.boardId;
    const url = new URL(req.url, serverConfig.hostname);
    url.pathname = `boards/${fullPath}`;
    url.search = "";

    const body = await getBody(req);
    await runBoard(url, res, body);
  });

  router.post("/@:user/:name.api/describe", describeBoard);

  router.get("/@:user/:name.invite", inviteList);

  router.post("/@:user/:name.invite", async (req, res) => {
    const body = await getBody(req);
    await inviteUpdate(req, res, body);
  });

  router.post("/@:user/:name/assets/drive/:driveId", handleAssetsDriveRequest);

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
