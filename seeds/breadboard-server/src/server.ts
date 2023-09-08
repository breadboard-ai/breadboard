/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, RunResult } from "@google-labs/breadboard";
import { Request, Response } from "express";
import { Store } from "./store.js";
import { InputValues } from "@google-labs/graph-runner";
import { Writer } from "./writer.js";

export async function runResultLoop(
  writer: Writer,
  board: Board,
  inputs: InputValues,
  runResult: RunResult | undefined
) {
  if (runResult && runResult.type === "input") {
    runResult.inputs = inputs;
  }
  for await (const stop of board.run(undefined, undefined, runResult)) {
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

export const makeCloudFunction = (url: string) => {
  return async (req: Request, res: Response) => {
    // TODO: Handle loading errors here.
    const board = await Board.load(url);

    if (req.method !== "POST") {
      if (req.path === "/") {
        res.sendFile(
          new URL("../../public/index.html", import.meta.url).pathname
        );
      } else if (req.path === "/info") {
        res.type("application/json").send({
          url,
          title: board.title,
          description: board.description,
          version: board.version,
        });
      } else {
        res.status(404).send("Not found");
      }
      return;
    }

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
