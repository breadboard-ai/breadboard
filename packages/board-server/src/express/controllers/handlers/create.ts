/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from 'express';
import { getStore } from '../../../server/store.js';

export type CreateRequest = {
  name: string;
  dryRun?: boolean;
};

const create = async (req: Request, res: Response): Promise<void> => {
  // @todo: implement auth middleware
  // const userKey = authenticate(req, res);
  // if (!userKey) {
  //   return;
  // }
  const store = getStore();

  const userKey = req.query.API_KEY as string;

  const userStore = await store.getUserStore(userKey);
  if (!userStore.success) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const request = req.body as CreateRequest;
  const boardName = request.name;

  const result = await store.create(userStore.store!, boardName, !!request.dryRun);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(200).json({ path: result.path });
};

export default create;
