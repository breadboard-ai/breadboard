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
import { fetch } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";
import { contextToSlides } from "../generated/context-to-slides.js";
import { contextToTitle } from "../generated/context-to-title.js";
import { getDeckMetadata } from "../generated/get-deck-metadata.js";
import { getPresentationUrl } from "../generated/get-presentation-url.js";
import { headers } from "../internal/headers.js";

const context = input({
  title: "Context in",
  description:
    "The conversation context to convert to Google Slides. Only the last item in the context will be used for conversion.",
  type: array(annotate(object({}), { behavior: ["llm-content"] })),
});

const title = input({
  title: "Title",
  description: "The title of the Google Slide deck",
  type: array(annotate(object({}), { behavior: ["llm-content", "config"] })),
});

const createSlidesBody = contextToTitle({
  $metadata: {
    title: "To Title",
    description: "Converting LLM Content to New Slide Title",
  },
  context: title,
});

const createSlidesDoc = fetch({
  $metadata: {
    title: "Call Create Slides API",
    description: "Creating a new Slides presentation",
  },
  method: "POST",
  url: "https://slides.googleapis.com/v1/presentations",
  headers,
  body: createSlidesBody.outputs.body,
});

const metadata = getDeckMetadata({
  $metadata: {
    title: "Get Deck Metadata",
    description: "Get metadata of the newly created slide deck",
  },
  presentation: createSlidesDoc.outputs.response,
});

const { url } = urlTemplate({
  template:
    "https://slides.googleapis.com/v1/presentations/{presentationId}:batchUpdate",
  presentationId: metadata.outputs.presentationId,
}).outputs;

const toSlideRequests = contextToSlides({
  $metadata: {
    title: "To Slide Requests",
    description: "Converting LLM Content to Slide Requests",
  },
  context,
  slideId: metadata.outputs.slideId,
});

const callBatchUpdate = fetch({
  $metadata: {
    title: "Call Batch Update API",
    description: "Populating the slide deck.",
  },
  method: "POST",
  url,
  headers,
  body: toSlideRequests.outputs.body,
});

const getUrl = getPresentationUrl({
  $metadata: {
    title: "Get Presentation URL",
    description: "Extracting presentation URL from response",
  },
  response: callBatchUpdate.outputs.response,
});

const contextToSlidesBoard = board({
  id: "contextToSlides",
  metadata: {
    title: "Context to Slides",
    description: "Turns LLM Conversation Context into a Google Slides deck",
    icon: "google-drive",
  },
  inputs: { context, title },
  outputs: {
    context: output(getUrl.outputs.url, {
      title: "Result",
    }),
  },
});

export default contextToSlidesBoard;
