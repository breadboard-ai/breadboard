import type { Request, Response } from "express";
import { getStore } from "../../server/store.js";
import {
  createLoader,
  GraphStore,
  type GraphDescriptor,
  type NodeDescriberResult,
} from "@google-labs/breadboard";
import { addKeyInput } from "../../server/boards/describe.js";
import { asyncHandler } from "../support.js";
import { NodeSandbox } from "@breadboard-ai/jsandbox/node";

function emptyDescriberResult(): NodeDescriberResult {
  return {
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
  };
}

const describe = async (req: Request, res: Response): Promise<void> => {
  const { user, boardName } = req.params;

  const store = getStore();

  const board = JSON.parse(await store.get(user!, boardName!)) as
    | GraphDescriptor
    | undefined;

  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const loader = createLoader();
  const graphStore = new GraphStore({
    kits: [],
    loader,
    sandbox: new NodeSandbox(),
  });

  const adding = graphStore.addByDescriptor(board);
  let describeResult: NodeDescriberResult;
  if (!adding.success) {
    describeResult = emptyDescriberResult();
  } else {
    const inspector = graphStore.inspect(adding.result, "");
    if (!inspector) {
      describeResult = emptyDescriberResult();
    } else {
      describeResult = await inspector.describe();
    }
  }
  const { title, description, metadata } = board;
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
