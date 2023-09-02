/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";

import process from "process";
import { Board, RunResult } from "@google-labs/breadboard";
import { Firestore } from "@google-cloud/firestore";

config();

const ONE_DAY = 24 * 60 * 60 * 1000;

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

const getBoardState = async (db, ticket) => {
  if (!ticket) return undefined;

  const docRef = await db.collection("states").doc(ticket);
  const doc = await docRef.get();
  if (!doc.exists) return undefined;

  return doc.data().state;
};

const saveBoardState = async (db, state) => {
  const docRef = await db.collection("states").doc();
  const expires = new Date(Date.now() + ONE_DAY);
  await docRef.set({ state, expires });
  return docRef.id;
};

const makeCloudFunction = (boardUrl) => {
  return async (req, res) => {
    if (req.method !== "POST") {
      res.sendFile(new URL("../public/index.html", import.meta.url).pathname);
      return;
    }

    const board = await Board.load(boardUrl);

    const firestore = new Firestore({
      databaseId: "breadboard-state",
    });

    const { $ticket, ...inputs } = req.body;

    const savedState = await getBoardState(firestore, $ticket);

    let runResult = savedState ? RunResult.load(savedState) : undefined;

    const { state, outputs } = await runResultLoop(board, inputs, runResult);

    const ticket = await saveBoardState(firestore, state);

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
