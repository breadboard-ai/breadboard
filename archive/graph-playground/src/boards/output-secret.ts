/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";

const board = new Board();
const core = board.addKit(Core);

core.secrets({ keys: ["PALM_KEY"] }).wire("PALM_KEY", board.output());

export default board;
