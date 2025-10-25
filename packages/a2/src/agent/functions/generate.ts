/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import z from "zod";
import gemini, { GeminiAPIOutputs, GeminiInputs, Tool } from "../../a2/gemini";
import { callGeminiImage } from "../../a2/image-utils";
import { A2ModuleArgs } from "../../runnable-module-factory";
import { AgentFileSystem } from "../file-system";
import { defineFunction, FunctionDefinition } from "../function-definition";
import { defaultSystemInstruction } from "../../generate-text/system-instruction";
import { mergeTextParts } from "../../a2/utils";

export { initializeGenerateFunctions };

export type GenerateFunctionArgs = {
  fileSystem: AgentFileSystem;
  caps: Capabilities;
  moduleArgs: A2ModuleArgs;
};

function initializeGenerateFunctions(
  args: GenerateFunctionArgs
): FunctionDefinition[] {
  const { fileSystem, caps, moduleArgs } = args;
  return [
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

        const generated = await callGeminiImage(
          caps,
          moduleArgs,
          prompt,
          [],
          true
        );
        if (!ok(generated)) return generated;
        const errors: string[] = [];
        const images = (
          await Promise.all(
            generated?.at(0)?.parts?.map((part) => fileSystem.add(part)) || []
          )
        ).map((part) => {
          if (!ok(part)) {
            errors.push(part.$error);
            return "";
          }
          return part;
        });
        if (errors.length > 0) {
          return err(errors.join(","));
        }
        return { images };
      }
    ),
    defineFunction(
      {
        name: "generate_text",
        description: `An extremely versatile text generator, powered by Gemini
Use it for any tasks that involve generation of text. Supports multimodal 
content input.`,
        parameters: {
          prompt: z.string().describe(`Detailed prompt to use for text
generation.`),
          context: z.array(z.string().describe(`The VFS path to a file`))
            .describe(`A list of files or folios to use as context for the 
prompt.`),
          search_grounding: z.boolean().describe(`Whether or not to use
Google Search grounding. Grounding with Google Search connects the Gemini model
to real-time web content and works with all available languages. This allows 
Gemini to provide more accurate answers and cite verifiable sources beyond its 
knowledge cutoff.`),
          maps_grounding: z.boolean().describe(`Whether or not to use
Google Maps grounding. Grounding with Google Maps connects the generative 
capabilities of Gemini with the rich, factual, and up-to-date data of Google 
Maps`),
        },
        response: {
          file_path: z.string().describe(`The VFS path with the result`),
        },
      },
      async ({ prompt, search_grounding, maps_grounding, context }) => {
        console.log(
          "Generating text from prompt",
          prompt,
          "with context",
          context
        );
        let tools: Tool[] | undefined = [];
        if (search_grounding) {
          tools.push({ googleSearch: {} });
        }
        if (maps_grounding) {
          tools.push({ googleMaps: {} });
        }
        if (tools.length === 0) tools = undefined;
        const parts = context
          .flatMap((path) => {
            const file = fileSystem.get(path);
            if (!ok(file)) return null;
            return file;
          })
          .filter((file) => file !== null);
        parts.unshift({ text: prompt });
        const contents = [{ parts }];
        const inputs: GeminiInputs = {
          model: "gemini-pro-latest",
          systemInstruction: defaultSystemInstruction(),
          body: {
            contents,
            tools,
          },
        };
        const generating = (await gemini(
          inputs,
          caps,
          moduleArgs
        )) as Outcome<GeminiAPIOutputs>;
        if (!ok(generating)) return generating;
        const content = generating.candidates.at(0)?.content;
        if (!content || content.parts.length === 0) {
          return err(`No content generated`);
        }
        const textParts = mergeTextParts(content.parts);
        if (textParts.length > 1) {
          console.warn(`More than one part generated`, content);
        }
        const part = textParts[0];
        const file_path = fileSystem.add(part);
        if (!ok(file_path)) return file_path;
        return { file_path };
      }
    ),
  ];
}
