/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Case } from "./types";

export const evalSet: Case[] = [
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
];
