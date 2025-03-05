/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Request, Router } from "express";

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

  router.get("/", async (req, res) => {
    await listBoards(req, res);
  });

  router.post("/", async (req, res) => {
    await createBoard(req, res);
  });

  router.get("/@:user/:name.json", async (req, res) => {
    const { user, name } = getBoardId(req);
    await getBoard(user, name, req, res);
  });

  router.post("/@:user/:name.json", async (req, res) => {
    const { fullPath } = getBoardId(req);
    const body = await getBody(req);

    const maybeDelete = body as { delete: boolean };
    if (maybeDelete.delete === true) {
      await del(fullPath, req, res);
    } else {
      await post(fullPath, req, res, body);
    }
  });

  router.get("/@:user/:name.app", async (req, res) => {
    const { user, name } = getBoardId(req);
    // Serve the index.html file for the app.
    await serveIndex(serverConfig, res, getMetadata(user, name));
  });

  router.get("/@:user/:name.api", async (_req, res) => {
    await serveFile(serverConfig, res, "/api.html");
  });

  router.post("/@:user/:name.api/invoke", async (req, res) => {
    const { fullPath, name, user } = getBoardId(req);
    const url = new URL(req.url, serverConfig.hostname);
    url.pathname = `boards/${fullPath}`;
    url.search = "";

    const body = await getBody(req);
    await invokeBoard(fullPath, user, name, url, res, body);
  });

  router.post("/@:user/:name.api/run", async (req, res) => {
    const { fullPath, name, user } = getBoardId(req);
    const url = new URL(req.url, serverConfig.hostname);
    url.pathname = `boards/${fullPath}`;
    url.search = "";

    const body = await getBody(req);
    await runBoard(fullPath, user, name, url, res, body);
  });

  router.post("/@:user/:name.api/describe", async (req, res) => {
    const { name, user } = getBoardId(req);
    await describeBoard(user, name, res);
  });

  router.get("/@:user/:name.invite", async (req, res) => {
    const { fullPath } = getBoardId(req);
    await inviteList(fullPath, req, res);
  });

  router.post("/@:user/:name.invite", async (req, res) => {
    const body = await getBody(req);
    const { fullPath } = getBoardId(req);
    await inviteUpdate(fullPath, req, res, body);
  });

  router.post("/@:user/:name/assets/drive/:driveId", async (req, res) => {
    const driveId = req.params["driveId"] ?? "";
    await handleAssetsDriveRequest(driveId, req, res);
  });

  return router;
}

function getBoardId(request: Request): BoardId {
  const user = request.params["user"] ?? "";
  const name = (request.params["name"] ?? "") + ".json";
  const fullPath = `@${user}/${name}`;
  return { user, name, fullPath };
}
