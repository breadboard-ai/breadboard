/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from 'express';
import { getStore } from '../../server/store.js';
import type { BoardListEntry } from '../../server/store.js';
import { asyncHandler } from '../support.js';

const list = async (req: Request, res: Response) => {
    const store = getStore();
  const userApiKey = req.query.API_KEY as string;
  const boards = await store.list(userApiKey);

  // Add .json extension to the path of each board
  const boardsWithJsonExt: BoardListEntry[] = boards.map(board => ({
    ...board,
    path: `${board.path}.json`
  }));

  res.json(boardsWithJsonExt);
};

const boardList = asyncHandler(list);
export { boardList as list };