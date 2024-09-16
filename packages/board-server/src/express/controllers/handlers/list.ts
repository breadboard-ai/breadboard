/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type{ Request, Response } from 'express';
import { getStore } from '../../../server/store.js';

const list = async (req: Request, res: Response) => {
  const store = getStore();
  const userApiKey = req.query.API_KEY as string;
  const boards = await store.list(userApiKey);
  res.json(boards);
};

export default list;
