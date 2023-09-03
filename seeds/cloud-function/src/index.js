/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";

import process from "process";
import { Board, RunResult } from "@google-labs/breadboard";
import { Store } from "./store.js";

config();

const runResultLoop = async (board, inputs, runResult) => {
  let outputs;

  let repeat = 2;
  while (repeat--) {
    for await (const stop of board.run(undefined, undefined, runResult)) {
      if (stop.seeksInputs) {
        stop.inputs = inputs;
      } else {
        outputs = stop.outputs;
        return {
          outputs,
          state: stop.save(),
        };
      }
    }
    runResult = undefined;
  }
};

const makeCloudFunction = (url) => {
  return async (req, res) => {
    if (req.method !== "POST") {
      if (req.path === "/") {
        res.sendFile(new URL("../public/index.html", import.meta.url).pathname);
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

    const { $ticket, ...inputs } = req.body;

    const savedState = await store.loadBoardState($ticket);

    let runResult = savedState ? RunResult.load(savedState) : undefined;

    const { state, outputs } = await runResultLoop(board, inputs, runResult);

    const ticket = await store.saveBoardState($ticket || "", state);

    res.type("application/json").send(
      JSON.stringify(
        {
          ...outputs,
          $ticket: ticket,
        },
        null,
        2
      )
    );
  };
};

export const board = makeCloudFunction(process.env.BOARD_URL);
