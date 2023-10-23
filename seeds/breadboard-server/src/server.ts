/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type GraphMetadata,
  type InputValues,
  BoardRunner,
  RunResult,
} from "@google-labs/breadboard";
import { Request, Response } from "express";
import { Store } from "./store.js";
import { Writer, WriterResponse } from "./writer.js";

export type ServerRequest = Pick<Request, "path" | "method" | "body">;
export type ServerResponse = Pick<
  Response,
  "send" | "status" | "type" | "sendFile" | "end"
> &
  WriterResponse;

export async function runResultLoop(
  writer: Writer,
  board: BoardRunner,
  inputs: InputValues,
  runResult: RunResult | undefined
) {
  if (runResult && runResult.type === "input") {
    runResult.inputs = inputs;
  }
  for await (const stop of board.run(undefined, runResult)) {
    if (stop.type === "beforehandler") {
      writer.writeBeforeHandler(stop);
      continue;
    }
    if (stop.type === "input") {
      // TODO: This case is for the "runOnce" invocation, where the board
      // isn't expected to stream outputs and inputs.
      if (inputs && Object.keys(inputs).length > 0) {
        stop.inputs = inputs;
        continue;
      }
      await writer.writeInput(stop);
      return;
    }
    if (stop.type === "output") {
      await writer.writeOutput(stop);
      return;
    }
  }

  writer.writeDone();
}

export const handleNonPostRequest = (
  { url, title, description, version }: GraphMetadata,
  req: ServerRequest,
  res: ServerResponse
): boolean => {
  if (req.method === "POST") return false;
  if (req.method !== "GET") {
    res.status(405);
    res.send("Method not allowed");
    return true;
  }
  if (req.path === "/") {
    res.sendFile(new URL("../../public/index.html", import.meta.url).pathname);
    return true;
  } else if (req.path === "/info") {
    res.type("application/json");
    res.send({ url, title, description, version });
    return true;
  } else {
    res.status(404);
    res.send("Not found");
    return true;
  }
};

export const makeCloudFunction = (url: string) => {
  return async (req: ServerRequest, res: ServerResponse) => {
    // TODO: Handle loading errors here.
    const board = await BoardRunner.load(url);

    if (handleNonPostRequest(board, req, res)) return;

    const store = new Store("breadboard-state");

    const { state, inputs } = req.body;

    const writer = new Writer(res, async (newState) =>
      store.saveBoardState(state || "", newState)
    );

    res.type("application/json");

    try {
      const savedState = await store.loadBoardState(state);
      const runResult = savedState ? RunResult.load(savedState) : undefined;

      await runResultLoop(writer, board, inputs, runResult);
    } catch (e) {
      console.error(e);
      const error = e as Error;
      writer.writeError(error);
    }

    writer.writeStop();
    res.end();
  };
};
