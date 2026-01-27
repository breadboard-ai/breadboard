/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../../src/a2/a2/utils.js";

export const title = "Impossible task";

export const objective =
  llm`Access my Google Calendar and give me the list of events I have today`.asContent();
