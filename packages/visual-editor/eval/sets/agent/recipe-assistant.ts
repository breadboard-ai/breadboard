/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../../src/a2/a2/utils.js";

export const title = "Recipe Assistant";

export const objective =
  llm`Act as a recipe assistant. Using text entry, ask the user about their dietary preferences and favorite cuisine, then suggest a recipe that matches their preferences. Present the final recipe with ingredients and instructions.`.asContent();

export const userObjective =
  "Only reveal the information that was requested, and do not reveal any additional information. You are a vegetarian and you like Italian food. You like simple recipes that don't take too long to make.";
