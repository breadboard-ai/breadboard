/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";

import { Board } from "@google-labs/breadboard";

config();

export const math = async (req, res) => {
  if (req.method !== "POST") {
    res.sendFile(new URL("../public/index.html", import.meta.url).pathname);
    return;
  }

  const board = await Board.load("./graphs/math.json");

  const text = req.body.text;

  const outputs = await board.runOnce({ text });

  res.type("application/json").send(JSON.stringify(outputs, null, 2));
};
