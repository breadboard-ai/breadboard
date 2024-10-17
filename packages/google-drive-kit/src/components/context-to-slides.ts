/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  array,
  board,
  input,
  object,
  output,
} from "@breadboard-ai/build";
import { contextToSlides as toSlideRequestsCode } from "../generated/context-to-slides.js";

const context = input({
  title: "Context in",
  description:
    "The conversation context to convert to Google Slides. Only the last item in the context will be used for conversion.",
  type: array(annotate(object({}), { behavior: ["llm-content"] })),
});

const toSlideRequests = toSlideRequestsCode({
  $metadata: {
    title: "To Slide Requests",
    description: "Converting LLM Content to Slide Requests",
  },
  context,
});

const contextToSlides = board({
  id: "contextToSlides",
  metadata: {
    title: "Context to Slides",
    description: "Turns LLM Conversation Context into a Google Slides deck",
    icon: "google-drive",
  },
  inputs: { context },
  outputs: {
    context: output(toSlideRequests.outputs.context, {
      title: "Result",
    }),
  },
});

export default contextToSlides;
