/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Request, Response } from 'express';
import { getStore } from '../../../server/store.js';

const get = async (req: Request, res: Response) => {
  const { userName, boardName } = req.params;

  const store = getStore();

  const board = await store.get(userName!, boardName!);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(board);
  return true;
};

export default get;
