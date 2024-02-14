/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, board } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const metaData = {
  title: "Generate an text response from a prompt",
  description: "Generates an text response using  LLM provider ",
  version: "0.0.3",
};

export default await board(({ prompt, provider }) => {
  prompt.title("prompt").description("The prompt to complete").isString();
  prompt.title("provider").description("The provider to use").isString();

  return core
    .invoke({
      prompt,
      path: provider,
    })
    .text_response.to(base.output({ $id: "text_response" }));
}).serialize(metaData);
