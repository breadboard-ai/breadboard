/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from 'express';
import { getStore } from '../../server/store.js';
import { asyncHandler } from '../support.js';

export type CreateRequest = {
  name: string;
  dryRun?: boolean;
};

const create = async (req: Request, res: Response): Promise<void> => {
  const store = getStore();

  const username = res.locals.username;

  const request = req.body as CreateRequest;
  const boardName = request.name;

  const result = await store.create(username, boardName, !!request.dryRun);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(200).json({ created: `${result.path}.json`});
};

const boardCreate = asyncHandler(create);
export { boardCreate as create };
