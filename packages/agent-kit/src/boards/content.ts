/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { starInputs, board, object, array } from "@breadboard-ai/build";
import { content } from "../templating.js";
import { code } from "@google-labs/core-kit";
import contentDescriber from "./internal/content-describer.js";
import { GenericBoardDefinition } from "@breadboard-ai/build/internal/board/board.js";
import { llmContentType } from "../context.js";

const inputs = starInputs({ type: object({}, "unknown") });

const substituteParams = code(
  {
    $metadata: {
      title: "Substitute Parameters",
      description: "Performing parameter substitution, if needed.",
    },
    "*": inputs,
  },
  {
    context: array(llmContentType),
  },
  content
);

export default board({
  title: "Content",
  description:
    "Use it as a way to initialize or add to conversation context, optionally applying extra arguments with mustache-style {{placeholders}}.",
  version: "0.1.0",
  metadata: {
    icon: "code-blocks",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/agents/#content",
    },
  },
  inputs: {
    "*": inputs,
  },
  outputs: {
    context: substituteParams.outputs.context,
  },
  describer: contentDescriber as GenericBoardDefinition,
});
