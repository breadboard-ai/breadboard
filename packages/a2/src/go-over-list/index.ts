/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as goOverListConversationalPlannerPrompt from "./conversational-planner-prompt";
import * as goOverListConversationalThinkStrategist from "./conversational-think-strategist";
import * as goOverListMain from "./main";
import * as goOverListOrganizerPrompt from "./organizer-prompt";
import * as goOverListParallelStrategist from "./parallel-strategist";
import * as goOverListPlannerPrompt from "./planner-prompt";
import * as goOverListRuntime from "./runtime";
import * as goOverListSequentialStrategist from "./sequential-strategist";
import * as goOverListSystemInstruction from "./system-instruction";
import * as goOverListThinkStrategist from "./think-strategist";
import * as goOverListTypes from "./types";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl";

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
