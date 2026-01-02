/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../../src/a2/a2/utils.js";

export const title = "News Tracker";

export const objective = llm`
Get a date-oriented summary of the latest news on the topic.

Remember these results, compare with what's been remembered before and return only the news items found this time. If no new news found, return "No news yet, but here's what happened so far" and add a summary for last seven days in descending order.

Topic:
Pittsburgh Penguins
`.asContent();
