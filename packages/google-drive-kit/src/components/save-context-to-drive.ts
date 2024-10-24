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

const context = input({
  title: "Context in",
  description: "The conversation context to save to Google Drive.",
  type: array(annotate(object({}), { behavior: ["llm-content"] })),
});

const key = input({
  title: "Key",
  description:
    "A unique key associated with this context, used to later load it from Google Drive.",
  type: annotate("string", { behavior: ["config"] }),
});

export default board({
  id: "saveContextToDrive",
  metadata: {
    title: "Save Context To Drive",
    description: "Saves LLM Conversation Context to Google Drive.",
    icon: "google-drive",
  },
  inputs: { context, key },
  outputs: {
    context: output(context, {
      title: "Context out",
      description: "The Context that was saved to Google Drive.",
    }),
    key: output(key),
  },
});
