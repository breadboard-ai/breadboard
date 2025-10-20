/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import z from "zod";
import { defineFunction } from "../define-function";
import { getFileHandle, write } from "../file-system";
import { GoogleGenAI } from "@google/genai";

export { generateFunctions };

const generateFunctions = [
  defineFunction(
    {
      name: "generate_video_from_frames",
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
      name: "generate_images_from_prompt",
      description: `Generates one or more images based on a prompt`,
      parameters: {
        prompt: z.string()
          .describe(`Detailed prompt to use for image generation.

This model can generate multiple images from a single prompt. Especially when
looking for consistency across images (for instance, when generating video 
keyframews), this is a very useful capability.

Be specific about how many images to generate.

When composing the prompt, be as descriptive as possible. Describe the scene, don't just list keywords.

The model's core strength is its deep language understanding. A narrative, descriptive paragraph will almost always produce a better, more coherent image than a list of disconnected words.

The following strategies will help you create effective prompts to generate exactly the images you're looking for.

- Be Hyper-Specific: The more detail you provide, the more control you have. Instead of "fantasy armor," describe it: "ornate elven plate armor, etched with silver leaf patterns, with a high collar and pauldrons shaped like falcon wings."
- Provide Context and Intent: Explain the purpose of the image. The model's understanding of context will influence the final output. For example, "Create a logo for a high-end, minimalist skincare brand" will yield better results than just "Create a logo."

- Use Step-by-Step Instructions: For complex scenes with many elements, break your prompt into steps. "First, create a background of a serene, misty forest at dawn. Then, in the foreground, add a moss-covered ancient stone altar. Finally, place a single, glowing sword on top of the altar."

- Use "Semantic Negative Prompts": Instead of saying "no cars," describe the desired scene positively: "an empty, deserted street with no signs of traffic."

- Control the Camera: Use photographic and cinematic language to control the composition. Terms like wide-angle shot, macro shot, low-angle perspective

- Use the full breadth of styles:

1. Photorealistic scenes - For realistic images, use photography terms. Mention camera angles, lens types, lighting, and fine details to guide the model toward a photorealistic result.

2. Stylized illustrations & stickers - To create stickers, icons, or assets, be explicit about the style and request a transparent background.

3. Accurate text in images - Gemini excels at rendering text. Be clear about the text, the font style (descriptively), and the overall design.

4. Product mockups & commercial photography - Perfect for creating clean, professional product shots for e-commerce, advertising, or branding.

5. Minimalist & negative space design - Excellent for creating backgrounds for websites, presentations, or marketing materials where text will be overlaid.

6. Sequential art (Comic panel / Storyboard) - Builds on character consistency and scene description to create panels for visual storytelling.
`),
      },
      response: {
        images: z
          .array(
            z.string().describe(`A generated image, specified as a VFS path`)
          )
          .describe(`Array of generated images`),
      },
    },
    async ({ prompt }) => {
      console.log("Generating image from prompt:", prompt);
      const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const generated = await gemini.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: prompt,
      });
      const images = await Promise.all(
        generated.candidates
          ?.at(0)
          ?.content?.parts?.filter((part) => "inlineData" in part)
          .map(async (part) => {
            const { data, mimeType } = part.inlineData!;
            return write(Buffer.from(data!, "base64"), mimeType!);
          }) || []
      );
      return { images };
    }
  ),
];
