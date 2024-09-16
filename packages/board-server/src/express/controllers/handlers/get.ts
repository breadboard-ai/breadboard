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
  
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }
  
  res.json(board);
};

export default get;
