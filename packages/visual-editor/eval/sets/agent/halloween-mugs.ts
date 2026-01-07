/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../../src/a2/a2/utils.js";

export const title = "Halloween Mugs";

export const objective =
  llm`Come up with 4 ideas for Halloween-themed mugs and turn them into images that can be used as inspirations for online storefront graphics. Caption each with a witty, humorous paragraph of text suitable for an instagram post`.asContent();
