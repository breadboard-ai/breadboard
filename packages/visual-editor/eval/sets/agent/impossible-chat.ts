/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../../src/a2/a2/utils.js";

export const title = "Impossible chat";

export const objective =
  llm`Ask the user for their name and location and then compose a poem based on that information`.asContent();
