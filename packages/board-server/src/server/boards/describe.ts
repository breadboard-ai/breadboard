/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createLoader,
  inspect,
  type GraphDescriptor,
  type NodeDescriberResult,
} from "@google-labs/breadboard";
import { serverError } from "../errors.js";
import { asInfo, getStore } from "../store.js";
import type { ApiHandler } from "../types.js";
import type { IncomingMessage } from "http";

export const getBoardUrl = (req: IncomingMessage, path: string) => {
  const host = req.headers.host || "";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}/boards/${path}`;
};

const describe: ApiHandler = async (path, req, res) => {
  const store = getStore();

  const { userStore, boardName } = asInfo(path);
  if (!userStore || !boardName) {
    serverError(res, "Invalid path");
    return true;
  }

  const board = JSON.parse(await store.get(userStore, boardName)) as
    | GraphDescriptor
    | undefined;
  if (!board) {
    serverError(res, "Board not found");
    return true;
  }

  board.url = getBoardUrl(req, path);

  const loader = createLoader();
  const inspector = inspect(board, { loader });
  const { title, description, metadata } = board;
  const describeResult = await inspector.describe();
  const result = {
    ...describeResult,
    title,
    description,
    metadata,
  } as NodeDescriberResult;

  res.writeHead(200, {
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(result, null, 2));

  return true;
};

export default describe;
