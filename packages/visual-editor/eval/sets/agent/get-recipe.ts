/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../../src/a2/a2/utils.js";

export const title = "Get recipe";

export const objective =
  llm`Get the recipe from provided URL and generate a detailed infographic image that guides the user to make the recipe even if they are not a skilled cook. Return only the infographic.

URL:  https://runningonrealfood.com/vegan-buckwheat-pancakes/ 
`.asContent();
