/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../../src/a2/a2/utils.js";

export const title = "News Tracker";

export const objective = llm`
Get a date-oriented summary of the latest news on the topic.

Remember these results.

Topic:
Pittsburgh Penguins
`.asContent();
