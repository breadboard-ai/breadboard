/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, ProbeEvent, RunResult } from "@google-labs/breadboard";
import { Request, Response } from "express";
import { Store } from "./store.js";
import { InputValues, OutputValues } from "@google-labs/graph-runner";

type RunResultLoopResult = {
  type: "input" | "output" | "done";
  data: InputValues | OutputValues;
  state: string | undefined;
};

const runResultLoop = async (
  board: Board,
  inputs: InputValues,
  runResult: RunResult | undefined,
  res: Response
): Promise<RunResultLoopResult> => {
  const progress = new EventTarget();
  progress.addEventListener("beforehandler", (e) => {
    const event = e as ProbeEvent;
    res.write(`progress:${JSON.stringify(event.detail.descriptor)}\n`);
  });

  if (runResult && runResult.type === "input") {
    runResult.inputs = inputs;
  }
  for await (const stop of board.run(progress, undefined, runResult)) {
    if (stop.type === "input") {
      if (inputs && Object.keys(inputs).length > 0) {
        stop.inputs = inputs;
        continue;
      }
      return {
        type: "input",
        data: stop.inputArguments,
        state: stop.save(),
      };
    }
    if (stop.type === "output") {
      return {
        type: "output",
        data: stop.outputs,
        state: stop.save(),
      };
    }
  }

  return {
    type: "done",
    data: {},
    state: undefined,
  };
};

export const makeCloudFunction = (url: string) => {
  return async (req: Request, res: Response) => {
    if (req.method !== "POST") {
      if (req.path === "/") {
        res.sendFile(
          new URL("../../public/index.html", import.meta.url).pathname
        );
      } else if (req.path === "/info") {
        res.type("application/json").send({
          url,
        });
      } else {
        res.status(404).send("Not found");
      }
      return;
    }

    const board = await Board.load(url);

    const store = new Store("breadboard-state");

    const { $ticket, inputs } = req.body;

    res.type("application/json");

    try {
      const savedState = await store.loadBoardState($ticket);

      const runResult = savedState ? RunResult.load(savedState) : undefined;

      const { type, state, data } = await runResultLoop(
        board,
        inputs,
        runResult,
        res
      );

      const ticket = await store.saveBoardState($ticket || "", state);

      res.write(`${type}:${JSON.stringify({ ...data, $ticket: ticket })}\n`);
    } catch (e) {
      console.error(e);
      const error = e as Error;
      res.write(`error:${JSON.stringify(error.message)}\n`);
    }

    res.write("done");

    res.end();
  };
};
