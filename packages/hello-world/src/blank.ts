/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board } from "@google-labs/breadboard";

export default await board(({ text }) => {
  return { text };
}).serialize({
  title: "Blank board",
  description: "A blank board. Use it to start a new board",
  version: "0.0.1",
});
