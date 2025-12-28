/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../../src/a2/a2/utils.js";

export const title = "Print or display";

export const objective = llm`
Depending on the directive below, either go to <a href="/print">Print</a> to print the page or to <a href="/display">Display</a> to display the page

Directive:

Could you please print the page?`.asContent();
