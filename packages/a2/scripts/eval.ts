/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EvalHarness } from "../src/eval-harness";
import { getDesignSurfaceSpecsPrompt } from "../src/agent/prompts/design-surface-specs";
import { llm } from "../src/a2/utils";
import { config } from "dotenv";

config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const harness = new EvalHarness({ apiKey: GEMINI_API_KEY });

const result = await harness.run(
  getDesignSurfaceSpecsPrompt([
    llm`Play a learning quiz on the following subject with a high school student, using a series of multiple-choice questions:

<subject>Fall of Communism in Soviet Russia</subject>

As the student answers the question, regulate the difficulty of questions. Start with the easy ones, and if the student is answering them correctly, proceed to the more challenging ones.

When the student fails to answer the question correctly, give them a brief historical overview and re-ask the question again in a slightly different way to test their knowledge.

After 5 questions, congratulate the student and exit the quiz. A student may decide to exit early and that is okay.

Before exiting, record the answers and the summary of the session for the teacher:

- questions asked and student's responses
- whether or not the student completed the quiz
- what the student learned
-  where the student should concentrate on learning`.asContent(),
  ])
);

console.log(result);
