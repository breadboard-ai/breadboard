/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, recipe, code } from "@google-labs/breadboard";

const metaData = {
  title: "Generate text from a prompt",
  description: "",
  version: "0.0.3",
};

const embeddingScheme = {
  type: "object",
  properties: {
    text: {
      type: "string",
      title: "text",
      description: "What is the prompt",
    },
  },
  required: ["text"],
};

export default await recipe(() => {
  const input = base.input({ $id: "input", schema: embeddingScheme });

  const textNode = code(({ text }) => {
    console.log("generating-text", text);
    if (text === undefined || text == ".") {
      throw new Error("generate-text: text is undefined");
    }
    return {
      text: "This is a test response against the following test input: " + text,
    };
  });

  return input.text.to(textNode()).text.to(base.output({ $id: "text_result" }));
}).serialize(metaData);
