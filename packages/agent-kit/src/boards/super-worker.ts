/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board } from "@google-labs/breadboard";
import { ContextItem } from "../context.js";

const sampleBookSpecs = `
description: This book will be about breadboards and how awesome they are
chapter target: 10
page target: 400
fiction genre: space opera
setting: the planet where there are no breadboards
story arc: A girl named Aurora invents a breadboard on the planet where breadboards are strictly forbidden. Through struggles and determination, and with the help of trusted friends, Aurora overcomes many challenges and changes the whole planet for the better. 
tonality: futuristic struggle, but optimistic
working title: Aurora
`;

const sampleContext: ContextItem[] = [
  {
    role: "user",
    parts: [{ text: sampleBookSpecs }],
  },
];

export default await board(({ context }) => {
  context
    .title("Context")
    .isArray()
    .behavior("llm-content")
    .examples(JSON.stringify(sampleContext, null, 2));

  return { context };
}).serialize({
  title: "Super Worker",
  description:
    "All-in-one worker. A work in progress, incorporates all the learnings from making previous workers.",
});
