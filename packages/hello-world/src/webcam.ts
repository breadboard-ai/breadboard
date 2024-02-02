/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

// A URL of the Gemini Pro Vision board. We will invoke this board to
// describe the picture.
const visionBoard =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/f4adabe69a5a9af73a29fcc72e7042404157717b/packages/breadboard-web/public/graphs/gemini-pro-vision.json";

// A node that appends the prompt to the picture.
// Note, this one is a bit "in the weeds": it literally formats the Gemini Pro
// API request to include the picture as part of the prompt.
const partsMaker = code(({ picture, prompt }) => {
  return { parts: [picture, { text: prompt }] };
});

export default await board(({ picture, prompt }) => {
  picture.isImage().title("Image").format("webcam");
  prompt
    .isString()
    .title("Prompt")
    .examples("Describe what you see in the picture");
  const { parts } = partsMaker({ picture, prompt });
  const describePicture = core.invoke({
    $id: "describePicture",
    path: visionBoard,
    parts,
  });
  return { text: describePicture.result };
}).serialize({
  title: "Webcam",
  description: "An example of using `gemini-pro-vision` board",
  version: "0.0.2",
});
