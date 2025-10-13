/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Case } from "./types";

export const cases: Case[] = [
  {
    name: "a-insta-caption",
    prompt: `For each image in {{input1}}, provide a catchy caption suitable for an Instagram post. Output them collated into pairs: image + caption + image + caption, etc.`,
    inputs: ["input1"],
  },
  {
    name: "b-count-images",
    prompt: `Count the images in the {{input1}} and return the number of images as the only output`,
    inputs: ["input1"],
  },
  {
    name: "interleave-images",
    prompt: `Take images from {{input1}} and interleave them with images from {{input2}}. Disacard any other kinds of content.`,
    inputs: ["input1", "input2"],
  },
  {
    name: "create-videos-from-frames",
    prompt: `Make a series of generated videos based on the provided sequence of images:

{{input1}}

First, prepare the the list of tasks for the video model, starting with first image. Each task consists of the starting frame (current image in sequence) and end frame (next image in sequence). Then, generate video from each task.
`,
    inputs: ["input1"],
  },
  {
    name: "insta-from-ideas",
    prompt: `Take text that contain ideas in {{input1}}, then use Gemini to split it into JSON list of ideas. Then for each idea in the list, create a detailed prompt for an Instagram image and a caption that goes along with the image. Then, generate an image for each prompt. Output in pairs: image + caption + image + caption, etc.
`,
    inputs: ["input1"],
  },
];
