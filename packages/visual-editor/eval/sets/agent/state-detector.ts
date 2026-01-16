/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Template } from "../../../src/a2/a2/template.js";
import { llm } from "../../../src/a2/a2/utils.js";

export const title = "State Detector";

export const objective = llm`
Look at the game state below and if the state is empty, go to ${Template.route("New Game Screen", "new-game-screen")}. Otherwise, go to ${Template.route("Resume Game Screen", "resume-game-screen")}.

{
 gameState: {}
}
`.asContent();
