import type { Request, Response } from 'express';
import { getStore } from '../../server/store.js';
import { createLoader, inspect, type GraphDescriptor, type NodeDescriberResult } from "@google-labs/breadboard";
import { addKeyInput } from '../../server/boards/describe.js';
import { asyncHandler } from '../support.js';

const describe = async (req: Request, res: Response): Promise<void> => {
  const { user, boardName } = req.params;

  const store = getStore();

  const board = JSON.parse(await store.get(user!, boardName!)) as GraphDescriptor | undefined;

  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  const loader = createLoader();
  const inspector = inspect(board, { loader });
  const { title, description, metadata } = board;
  const describeResult = await inspector.describe();
  addKeyInput(describeResult);
  const result = {
    ...describeResult,
    title,
    description,
    metadata,
  } as NodeDescriberResult;

  res.json(result);
};

const boardDescribe = asyncHandler(describe);
export { boardDescribe as describe };
