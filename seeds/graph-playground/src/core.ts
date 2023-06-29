/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Truly core nodes that are necessary for building and composing graphs.
 */
import input from "./nodes/input.js";
import output from "./nodes/output.js";
import passthrough from "./nodes/passthrough.js";
import include from "./nodes/include.js";
import vars from "./nodes/vars.js";
import { slot, slotInput, slotOutput } from "./nodes/slot.js";

/**
 * Nodes that are commonly used in Generative Applications.
 */
import promptTemplate from "./nodes/prompt-template.js";
import textCompletion from "./nodes/text-completion.js";
import localMemory from "./nodes/local-memory.js";
import javascript from "./nodes/run-javascript.js";

/**
 * A node-producing wrapper to create custom nodes.
 */
export { customNode } from "./nodes/custom-node.js";

export const coreHandlers = {
  input,
  output,
  passthrough,
  include,
  vars,
  slot,
  "slot-input": slotInput,
  "slot-output": slotOutput,
  "prompt-template": promptTemplate,
  "text-completion": textCompletion,
  "local-memory": localMemory,
  "run-javascript": javascript,
};
