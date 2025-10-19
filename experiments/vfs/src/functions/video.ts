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
      name: "video_from_frames",
      description:
        "Generates a video given two frames: starting frame and ending frame",
      parameters: {
        startFrame: z.string().describe(
          `The starting frame of the video, specified as a VFS 
  path pointing to an existing image`
        ),
        endFrame: z.string()
          .describe(`The end frame of the video, specified as a VFS path
  pointing to an existing image`),
      },
      response: {
        video: z
          .string()
          .describe("The generated video, specified as a VFS path"),
      },
    },
    async ({ startFrame, endFrame }) => {
      console.log("Generating video from", startFrame, "to", endFrame);
      return { video: getFileHandle(".mp4") };
    }
  ),
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
