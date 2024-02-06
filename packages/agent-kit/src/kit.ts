/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";

import worker from "./boards/worker.js";
import instruction from "./boards/instruction.js";

import { Core } from "@google-labs/core-kit";

// TODO: Convert to new syntax
const kit = new Board({
  title: "Agent Kit",
  description:
    "This board is actually a kit: a collection of nodes for building Agent-like experiences.",
  version: "0.0.1",
});
const core = kit.addKit(Core);

core.invoke({ $id: "worker", graph: worker });
core.invoke({ $id: "instruction", graph: instruction });

export default kit;
