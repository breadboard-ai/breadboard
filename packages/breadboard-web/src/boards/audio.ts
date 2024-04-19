/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, code } from "@google-labs/breadboard";
import { gemini } from "@google-labs/gemini-kit";

// A node that appends the prompt to the audio.
// Note, this one is a bit "in the weeds": it literally formats the Gemini Pro
// API request to include the audio as part of the prompt.
const partsMaker = code(({ audio, prompt }) => {
  return { context: { parts: [audio, { text: prompt }] } };
});

export default await board(({ audio, prompt }) => {
  audio.isAudio().title("Audio").format("microphone");
  prompt
    .isString()
    .title("Prompt")
    .examples(
      "Describe what you hear in the audio. Please respond in markdown"
    );
  const { context } = partsMaker({
    $id: "combineAudioAndPrompt",
    audio,
    prompt,
  });
  const describeAudio = gemini.text({
    $id: "describeAudio",
    model: "gemini-1.5-pro-latest",
    text: "unused",
    context,
  });
  return { text: describeAudio.text.format("markdown") };
}).serialize({
  title: "Audio",
  description: "An example of using Gemini Kit's vision(?) node with audio",
  version: "0.0.1",
});
