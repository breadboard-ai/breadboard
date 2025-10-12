/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Case } from "./types";

export const evalSet: Case[] = [
  {
    name: "a-insta-caption",
    prompt: `For each image in 
{{"type": "in", "path": "5960f99b-470c-4ef6-bdd2-1864c32086eb", "title": "Images"}}, provide a catchy caption suitable for an Instagram post. Output them collated into pairs: image + caption + image + caption, etc.`,
  },
  {
    name: "b-count-images",
    prompt:
      "Count the images in the input and return the number of images as the only output",
  },
];
