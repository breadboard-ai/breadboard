/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Strings from "../strings/helper.js";
import { blank } from "../../engine/editor/blank.js";

const GlobalStrings = Strings.forSection("Global");

export function blankBoard() {
  const blankBoard = blank();
  const title =
    GlobalStrings.from("TITLE_UNTITLED_PROJECT") || blankBoard.title;
  return { ...blank(), title };
}
