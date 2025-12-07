/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as goOverListConversationalPlannerPrompt from "./conversational-planner-prompt.js";
import * as goOverListConversationalThinkStrategist from "./conversational-think-strategist.js";
import * as goOverListMain from "./main.js";
import * as goOverListOrganizerPrompt from "./organizer-prompt.js";
import * as goOverListParallelStrategist from "./parallel-strategist.js";
import * as goOverListPlannerPrompt from "./planner-prompt.js";
import * as goOverListRuntime from "./runtime.js";
import * as goOverListSequentialStrategist from "./sequential-strategist.js";
import * as goOverListSystemInstruction from "./system-instruction.js";
import * as goOverListThinkStrategist from "./think-strategist.js";
import * as goOverListTypes from "./types.js";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl.js";

export const exports = {
  "conversational-planner-prompt": goOverListConversationalPlannerPrompt,
  "conversational-think-strategist": goOverListConversationalThinkStrategist,
  main: goOverListMain,
  "organizer-prompt": goOverListOrganizerPrompt,
  "parallel-strategist": goOverListParallelStrategist,
  "planner-prompt": goOverListPlannerPrompt,
  runtime: goOverListRuntime,
  "sequential-strategist": goOverListSequentialStrategist,
  "system-instruction": goOverListSystemInstruction,
  "think-strategist": goOverListThinkStrategist,
  types: goOverListTypes,
};

export const bgl = createBgl(descriptor, exports);
