/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from 'express';
import type { GraphDescriptor } from "@google-labs/breadboard";
// import { authenticate } from "../auth.js";
// import { serverError } from "../errors.js";
import { getStore } from '../../../server/store.js';


const update = async (req: Request, res: Response): Promise<void> => {
  const { user, boardName } = req.params;

  // @todo move authentiation to middleware
  // const userKey = authenticate(req, res);
  // if (!userKey) {
  //   return;
  // }
  const store = getStore();
  const userStore = await store.getUserStore(user!);

  if (!userStore.success) {
    res.status(401).json({ error: "Unauthorized" });
  }

  const maybeGraph = req.body as GraphDescriptor;

  if (!("nodes" in maybeGraph && "edges" in maybeGraph)) {
    res.status(400).json({ error: "Invalid graph structure" });
    return;
  }

  const result = await store.update(user!, boardName!, maybeGraph);
  if (!result.success) {
    res.status(500).json({ error: result.error });
  }

  res.status(200).json({ created: `@${user}/${boardName}` });
};

export default update;
