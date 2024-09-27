/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Request, Response } from 'express';
import { getStore } from '../../../server/store.js';

const get = async (req: Request, res: Response): Promise<void> => {
  const { user, boardName } = req.params;

  const store = getStore();

  const board = await store.get(user!, boardName!);

  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }
  
  res.json(board);
};

export default get;
