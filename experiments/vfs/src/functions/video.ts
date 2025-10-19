/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import z from "zod";
import { defineFunction } from "../define-function";
import { getFileHandle } from "../file-system";

export { videoFunctions };

const videoFunctions = [
  defineFunction(
    {
      name: "concatenate_videos",
      description: "Contatenates two or more videos together",
      parameters: {
        videos: z.array(z.string())
          .describe(`The array of the videos to concatenate. 
    The videos will be concatented in the order they are provided`),
      },
      response: {
        video: z
          .string()
          .describe("The resulting video, provided as a VFS path"),
      },
    },
    async ({ videos }) => {
      console.log("Concatenating videos", videos);
      return { video: getFileHandle(".mp4") };
    }
  ),
];
