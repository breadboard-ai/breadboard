/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import { TemplateKit } from "@google-labs/template-kit";
import { PaLMKit } from "@google-labs/palm-kit";

const autoSimplePrompt = new Board();
const kit = autoSimplePrompt.addKit(TemplateKit);
const palm = autoSimplePrompt.addKit(PaLMKit);
const core = autoSimplePrompt.addKit(Core);

const completion = palm.generateText();
core.secrets({ keys: ["PALM_KEY"] }).wire("PALM_KEY", completion);
kit
  .promptTemplate({
    $id: "analyze-this",
    template:
      "Analyze the following question and instead of answering, list out steps to take to answer the question: {{question}}",
    question: "How is the weather?",
  })
  .wire(
    "prompt->text",
    completion.wire("completion->text", autoSimplePrompt.output())
  );

export default autoSimplePrompt;
