/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";

import worker from "./boards/worker.js";
import repeater from "./boards/repeater.js";
import structuredWorker from "./boards/structured-worker.js";
import human from "./boards/human.js";
import toolWorker from "./boards/tool-worker.js";

import { Core } from "@google-labs/core-kit";
import specialist from "./boards/specialist.js";
import looper from "./boards/looper.js";
import joiner from "./boards/joiner.js";

// TODO: Convert to new syntax
const kit = new Board({
  title: "Agent Kit",
  description:
    "This board is actually a kit: a collection of nodes for building Agent-like experiences.",
  version: "0.0.1",
});
const core = kit.addKit(Core);

core.invoke({ $id: "worker", $board: worker });
core.invoke({ $id: "repeater", $board: repeater });
core.invoke({ $id: "structured-worker", $board: structuredWorker });
core.invoke({ $id: "human", $board: human });
core.invoke({ $id: "tool-worker", $board: toolWorker });
core.invoke({ $id: "specialist", $board: specialist });
core.invoke({ $id: "looper", $board: looper });
core.invoke({ $id: "joiner", $board: joiner });

export default kit;
