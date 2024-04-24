/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, code } from "@google-labs/breadboard";
import { gemini } from "@google-labs/gemini-kit";

const contextify = code(({ audio }) => {
  return { context: [audio] };
});

export default await board(({ audio }) => {
  audio
    .isObject()
    .behavior("llm-content")
    .format("audio-microphone")
    .title("Audio");

  const { context } = contextify({
    $id: "contextify",
    $metadata: {
      title: "Wrap audio",
      description: "Wraps the audio in a context object for Gemini",
    },
    audio,
  });

  const describeAudio = gemini.text({
    $id: "describeAudio",
    model: "gemini-1.5-pro-latest",
    text: "unused",
    context,
    systemInstruction: `Describe what you hear in the audio. Please respond in markdown`,
  });
  return { text: describeAudio.text.format("markdown") };
}).serialize({
  title: "Audio",
  description: "An example of using Gemini Kit's vision(?) node with audio",
  version: "0.0.1",
});
