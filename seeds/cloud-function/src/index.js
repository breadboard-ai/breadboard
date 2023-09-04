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

const runResultLoop = async (board, inputs, runResult, res) => {
  const progress = new EventTarget();
  progress.addEventListener("beforehandler", (e) => {
    res.write(`progress:${JSON.stringify(e.detail.descriptor)}\n`);
  });

  if (runResult && runResult.seeksInputs) {
    runResult.inputs = inputs;
  }
  for await (const stop of board.run(progress, undefined, runResult)) {
    if (stop.seeksInputs) {
      if (inputs && Object.keys(inputs).length > 0) {
        stop.inputs = inputs;
        continue;
      }
      return {
        type: "input",
        data: stop.inputArguments,
        state: stop.save(),
      };
    } else {
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

    const { $ticket, inputs } = req.body;

    res.type("application/json");

    try {
      const savedState = await store.loadBoardState($ticket);

      let runResult = savedState ? RunResult.load(savedState) : undefined;

      const { type, state, data } = await runResultLoop(
        board,
        inputs,
        runResult,
        res
      );

      const ticket = await store.saveBoardState($ticket || "", state);

      res.write(`${type}:${JSON.stringify({ ...data, $ticket: ticket })}\n`);
    } catch (e) {
      res.write(`error:${JSON.stringify(e.message)}\n`);
    }

    res.write("done");

    res.end();
  };
};

export const board = makeCloudFunction(process.env.BOARD_URL);
