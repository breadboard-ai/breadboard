/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { kit } from "@breadboard-ai/build";
import human from "./boards/human.js";
import joiner from "./boards/joiner.js";
import looper from "./boards/looper.js";
import repeater from "./boards/repeater.js";
import specialist from "./boards/specialist.js";
import structuredWorker from "./boards/structured-worker.js";
import worker from "./boards/worker.js";
import content from "./boards/content.js";

const agentKit = await kit({
  title: "Agent Kit",
  description: "A collection of nodes for building Agent-like experiences.",
  version: "0.0.1",
  url: "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/agent-kit/graphs/kit.json",
  components: {
    content,
    human,
    joiner,
    looper,
    repeater,
    specialist,
    structuredWorker,
    worker,
  },
});

export default agentKit;
