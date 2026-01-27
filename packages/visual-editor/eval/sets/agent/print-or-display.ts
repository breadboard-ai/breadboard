/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import { Template } from "../../../src/a2/a2/template.js";
import { llm } from "../../../src/a2/a2/utils.js";

export const title = "Print or display";

const pageToPrint: LLMContent = {
  parts: [
    { storedData: { handle: "page/to/print", mimeType: "application/pdf" } },
  ],
};

export const objective = llm`
Depending on the directive below, either go to ${Template.route("Print", "/print")} to print the page or to ${Template.route("Display", "/display")} to display the page.

Directive:

Could you please print this page?

${pageToPrint}
`.asContent();
