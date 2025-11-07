/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, TextCapabilityPart } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import z from "zod";
import {
  conformGeminiBody,
  streamGenerateContent,
  Tool,
} from "../../a2/gemini";
import { callGeminiImage } from "../../a2/image-utils";
import { A2ModuleArgs } from "../../runnable-module-factory";
import { AgentFileSystem } from "../file-system";
import { defineFunction, FunctionDefinition } from "../function-definition";
import { defaultSystemInstruction } from "../../generate-text/system-instruction";
import { mergeContent, mergeTextParts, toText, tr } from "../../a2/utils";
import { callVideoGen, expandVeoError } from "../../video-generator/main";

export { defineGenerateFunctions };

const VIDEO_MODEL_NAME = "veo-3.1-generate-preview";

export type GenerateFunctionArgs = {
  fileSystem: AgentFileSystem;
  caps: Capabilities;
  moduleArgs: A2ModuleArgs;
};

function defineGenerateFunctions(
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
      async ({ prompt }, statusUpdater) => {
        statusUpdater("Generating Image(s)");
        console.log("PROMPT", prompt);

        const generated = await callGeminiImage(
          caps,
          moduleArgs,
          prompt,
          [],
          true
        );
        if (!ok(generated)) return generated;
        const errors: string[] = [];
        const images = mergeContent(generated, "user")
          .parts.map((part) => fileSystem.add(part))
          .map((part) => {
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
        description: `
An extremely versatile text generator, powered by Gemini. Use it for any tasks
that involve generation of text. Supports multimodal content input.`.trim(),
        parameters: {
          prompt: z.string().describe(
            `
Detailed prompt to use for text generation.`.trim()
          ),
          context: z
            .array(z.string().describe(`The VFS path to a file`))
            .describe(
              `
A list of files or projects to use as context for the prompt. These must be VFS
paths. If you need to pass text as context, first write it to file and pass the
VFS path of that file`.trim()
            )
            .optional(),
          model: z.enum(["pro", "flash", "lite"]).describe(tr`

The Gemini model to use for text generation. How to choose the right model:

- choose "pro" when reasoning over complex problems in code, math, and STEM, as well as analyzing large datasets, codebases, and documents using long context. Use this model only when dealing with exceptionally complex problems.
- choose "flash" for large scale processing, low-latency, high volume tasks that require thinking. This is the model you would use most of the time.
- choose "lite" for high throughput. Use this model when speed is paramount.

`),
          output_format: z.enum(["file", "text"]).describe(`The output format.
When "file" is specified, the output will be saved as a VFS file and the 
"file_path" response parameter will be provided as output. Use this when you
expect a long output from the text generator. When "text" is specified, the
output will be returned as text directlty, and the "text" response parameter
will be provided.`),
          project_path: z
            .string()
            .describe(
              `
The VFS path to a project. If specified, the result will be added to that
project. Use this parameter as a convenient way to add the generated output to an existing project.`.trim()
            )
            .optional(),
          search_grounding: z
            .boolean()
            .describe(
              `
Whether or not to use Google Search grounding. Grounding with Google Search
connects the Gemini model to real-time web content and works with all available 
languages. This allows Gemini to provide more accurate answers and cite
verifiable sources beyond its knowledge cutoff.`.trim()
            )
            .optional(),
          maps_grounding: z
            .boolean()
            .describe(
              `Whether or not to use
Google Maps grounding. Grounding with Google Maps connects the generative 
capabilities of Gemini with the rich, factual, and up-to-date data of Google 
Maps`
            )
            .optional(),
        },
        response: {
          error: z
            .string()
            .describe(
              `If an error has occurred, will contain a description of the error`
            )
            .optional(),
          file_path: z
            .string()
            .describe(
              `The VFS path with the output of the
generator. Will be provided when the "output_format" is set to "file"`
            )
            .optional(),
          text: z
            .string()
            .describe(
              `The text output of the generator. Will be 
provided when the "output_format" is set to "text"`
            )
            .optional(),
        },
      },
      async (
        {
          prompt,
          model,
          search_grounding,
          maps_grounding,
          context = [],
          project_path,
          output_format,
        },
        statusUpdater
      ) => {
        console.log("PROMPT", prompt);
        console.log("MODEL", model);
        console.log("CONTEXT", context);
        console.log("SEARCH_GROUNDING", search_grounding);
        console.log("MAPS_GROUNDING", maps_grounding);
        console.log("PROJECT_PATH", project_path);
        console.log("OUTPUT_PATH", output_format);

        if (search_grounding || maps_grounding) {
          statusUpdater("Researching");
        } else {
          statusUpdater("Generating Text");
        }

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
        const body = await conformGeminiBody(moduleArgs, {
          systemInstruction: defaultSystemInstruction(),
          contents,
          tools,
          generationConfig: {
            thinkingConfig: {
              thinkingBudget: -1,
              includeThoughts: true,
            },
          },
        });
        if (!ok(body)) return body;
        const resolvedModel = resolveModel(model);
        const generating = await streamGenerateContent(
          resolvedModel,
          body,
          moduleArgs
        );
        if (!ok(generating)) {
          return { error: generating.$error };
        }
        const results: TextCapabilityPart[] = [];
        for await (const chunk of generating) {
          const parts = chunk.candidates.at(0)?.content?.parts;
          if (!parts) continue;
          for (const part of parts) {
            if (!part || !("text" in part)) continue;
            if (part.thought) {
              statusUpdater(part.text, true);
            } else {
              results.push(part);
            }
          }
        }
        statusUpdater(null);
        const textParts = mergeTextParts(results, "\n");
        if (textParts.length === 0) {
          return { error: `No text was generated. Please try again` };
        }
        if (textParts.length > 1) {
          console.warn(`More than one part generated`, results);
        }
        const part = textParts[0];
        const file_path = fileSystem.add(part);
        if (!ok(file_path)) return file_path;
        if (project_path) {
          fileSystem.addFilesToProject(project_path, [file_path]);
        }
        if (output_format === "text") {
          return { text: toText({ parts: textParts }) };
        }
        return { file_path };
      }
    ),
    defineFunction(
      {
        name: "generate_video",
        description:
          "Generating high-fidelity, 8-second videos featuring stunning realism and natively generated audio",
        parameters: {
          prompt: z.string().describe(tr`
The prompt to generate the video.

Good prompts are descriptive and clear. Start with identifying your core idea, refine your idea by adding keywords and modifiers, and incorporate video-specific terminology into your prompts.

The following elements should be included in your prompt:

- Subject: The object, person, animal, or scenery that you want in your video, such as cityscape, nature, vehicles, or puppies.
- Action: What the subject is doing (for example, walking, running, or turning their head).
- Style: Specify creative direction using specific film style keywords, such as sci-fi, horror film, film noir, or animated styles like cartoon.
- Camera positioning and motion: [Optional] Control the camera's location and movement using terms like aerial view, eye-level, top-down shot, dolly shot, or worms eye.
- Composition: [Optional] How the shot is framed, such as wide shot, close-up, single-shot or two-shot.
- Focus and lens effects: [Optional] Use terms like shallow focus, deep focus, soft focus, macro lens, and wide-angle lens to achieve specific visual effects.
- Ambiance: [Optional] How the color and light contribute to the scene, such as blue tones, night, or warm tones.

`),
          aspectRatio: z
            .enum(["16:9", "9:16"])
            .describe(`The aspect ratio of the video`)
            .default("16:9"),
        },
        response: {
          error: z
            .string()
            .describe(
              `If an error has occurred, will contain a description of the error`
            )
            .optional(),
          video: z
            .string()
            .describe(`Generated video, specified as VFS path`)
            .optional(),
        },
      },
      async ({ prompt, aspectRatio }, statusUpdateCallback) => {
        console.log("PROMPT", prompt);
        console.log("ASPECT RATIO", aspectRatio);
        statusUpdateCallback("Generating Video");
        const generating = await callVideoGen(
          caps,
          moduleArgs,
          prompt,
          undefined,
          false,
          aspectRatio ?? "16:9",
          VIDEO_MODEL_NAME
        );
        if (!ok(generating)) {
          return { error: expandVeoError(generating, VIDEO_MODEL_NAME).$error };
        }
        const dataPart = generating.parts.at(0);
        if (!dataPart || !("storedData" in dataPart)) {
          return { error: `No video was generated` };
        }
        const video = fileSystem.add(dataPart);
        if (!ok(video)) {
          return { error: video.$error };
        }
        return { video };
      }
    ),
  ];
}

function resolveModel(model: "pro" | "lite" | "flash"): string {
  switch (model) {
    case "pro":
      return "gemini-2.5-pro";
    case "flash":
      return "gemini-2.5-flash";
    default:
      return "gemini-2.5-lite";
  }
}
