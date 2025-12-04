/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Strings from "../strings/helper.js";
import { blank as breadboardBlank } from "@google-labs/breadboard";

const GlobalStrings = Strings.forSection("Global");

export function blankBoard() {
  const blankBoard = breadboardBlank();
  const title =
    GlobalStrings.from("TITLE_UNTITLED_PROJECT") || blankBoard.title;
  return { ...breadboardBlank(), title };
}
