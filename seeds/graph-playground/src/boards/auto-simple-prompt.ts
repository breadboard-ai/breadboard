/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const autoSimplePrompt = new Board();
const kit = autoSimplePrompt.addKit(Starter);

const completion = kit.generateText();
kit.secrets(["PALM_KEY"]).wire("PALM_KEY", completion);
kit
  .promptTemplate(
    "Analyze the following question and instead of answering, list out steps to take to answer the question: {{question}}",
    { $id: "analyze-this", question: "How is the weather?" }
  )
  .wire(
    "prompt->text",
    completion.wire("completion->text", autoSimplePrompt.output())
  );

export default autoSimplePrompt;
