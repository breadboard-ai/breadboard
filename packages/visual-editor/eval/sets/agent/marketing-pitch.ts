/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../../src/a2/a2/utils.js";

export const title = "Marketing Pitch w/Critique";

export const objective =
  llm`Given a product, come up with a rubric for evaluating a marketing pitch for the rubric, then generate four different marketing pitches for the product, evaluate each using the rubric, and return the winning pitch

  Product: Bluetooth-enabled Electric Toothbrush`.asContent();
