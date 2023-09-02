/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";

import process from "process";
import { Board, RunResult } from "@google-labs/breadboard";

config();

const runResultLoop = async (board, inputs, runResult) => {
  let outputs;

  for (;;) {
    for await (const stop of board.run(undefined, undefined, runResult)) {
      if (stop.seeksInputs) {
        stop.inputs = inputs;
      } else {
        outputs = stop.outputs;
        outputs.$state = stop.save();
        return outputs;
      }
    }
    runResult = undefined;
  }
};

const makeCloudFunction = (boardUrl) => {
  return async (req, res) => {
    if (req.method !== "POST") {
      res.sendFile(new URL("../public/index.html", import.meta.url).pathname);
      return;
    }

    const board = await Board.load(boardUrl);

    const { $state, ...inputs } = req.body;

    let runResult = $state ? RunResult.load($state) : undefined;

    const outputs = await runResultLoop(board, inputs, runResult);

    res.type("application/json").send(JSON.stringify(outputs, null, 2));
  };
};

export const board = makeCloudFunction(process.env.BOARD_URL);
