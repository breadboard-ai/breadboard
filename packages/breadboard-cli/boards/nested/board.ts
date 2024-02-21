/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { board, base } from "@google-labs/breadboard";
import Util from "../utils.js";
export default await board(({ text }) => {
  console.log(Util);
  return base.output({ text: text });
}).serialize({
  title: "Blank board",
  description: "A blank board. Use it to start a new board",
  version: "0.0.2",
});
