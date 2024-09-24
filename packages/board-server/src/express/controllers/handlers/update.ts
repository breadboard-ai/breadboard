/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from 'express';
import type { GraphDescriptor } from "@google-labs/breadboard";
import { getStore } from '../../../server/store.js';


const update = async (req: Request, res: Response): Promise<void> => {
  const { user, boardName } = req.params;
  
  const store = getStore();

  const maybeGraph = req.body as GraphDescriptor;

  if (!("nodes" in maybeGraph && "edges" in maybeGraph)) {
    res.status(400).json({ error: "Invalid graph structure" });
    return;
  }

  const result = await store.update(user!, boardName!, maybeGraph);
  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.status(200).json({ created: `@${user}/${boardName}` });
};

export default update;
