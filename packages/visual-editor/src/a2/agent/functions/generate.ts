/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, TextCapabilityPart } from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import z from "zod";
import {
  conformGeminiBody,
  GenerationConfig,
  streamGenerateContent,
  Tool,
} from "../../a2/gemini.js";
import { callGeminiImage } from "../../a2/image-utils.js";
import { A2ModuleArgs } from "../../runnable-module-factory.js";
import { AgentFileSystem } from "../file-system.js";
import {
  defineFunction,
  FunctionDefinition,
  mapDefinitions,
} from "../function-definition.js";
import { defaultSystemInstruction } from "../../generate-text/system-instruction.js";
import { mergeContent, mergeTextParts, toText, tr } from "../../a2/utils.js";
import { callVideoGen, expandVeoError } from "../../video-generator/main.js";
import { callAudioGen, VOICES } from "../../audio-generator/main.js";
import { callMusicGen } from "../../music-generator/main.js";
import { PidginTranslator } from "../pidgin-translator.js";
import { FunctionGroup } from "../types.js";

export { getGenerateFunctionGroup };

const VIDEO_MODEL_NAME = "veo-3.1-generate-preview";
const RETRY_SLEEP_MS = 700;

export type GenerateFunctionArgs = {
  fileSystem: AgentFileSystem;
  caps: Capabilities;
  moduleArgs: A2ModuleArgs;
  translator: PidginTranslator;
};

const GENERATE_TEXT_FUNCTION = "generate_text";

const instruction = tr`

## When to call "${GENERATE_TEXT_FUNCTION}" function

When evaluating the objective, make sure to determine whether calling "${GENERATE_TEXT_FUNCTION}" is warranted. The key tradeoff here is latency: because it's an additional model call, the "generate_text" will take longer to finish.

Your job is to fulfill the objective as efficiently as possible, so weigh the need to invoke "${GENERATE_TEXT_FUNCTION}" carefully.

Here is the rules of thumb:

- For shorter responses like a chat conversation, just do the text generation yourself. You are an LLM and you can do it without calling "${GENERATE_TEXT_FUNCTION}".
- For longer responses like generating a chapter of a book or analyzing a large and complex set of files, use "${GENERATE_TEXT_FUNCTION}".


`;

function getGenerateFunctionGroup(args: GenerateFunctionArgs): FunctionGroup {
  return { ...mapDefinitions(defineGenerateFunctions(args)), instruction };
}

function defineGenerateFunctions(
  args: GenerateFunctionArgs
): FunctionDefinition[] {
  const { fileSystem, caps, moduleArgs, translator } = args;
  return [
    defineFunction(
      {
        name: "generate_images",
        description: `Generates one or more images based on a prompt and optionally, one or more images`,
        parameters: {
          prompt: z.string()
            .describe(`Detailed prompt to use for image generation.

This model can generate multiple images from a single prompt. Especially when
looking for consistency across images (for instance, when generating video 
keyframes), this is a very useful capability.

Be specific about how many images to generate.

When composing the prompt, be as descriptive as possible. Describe the scene, don't just list keywords.

The model's core strength is its deep language understanding. A narrative, descriptive paragraph will almost always produce a better, more coherent image than a list of disconnected words.

This function allows you to use multiple input images to compose a new scene or transfer the style from one image to another.

Here are some possible applications:

- Text-to-Image: Generate high-quality images from simple or complex text descriptions. Provide a text prompt and no images as input.

- Image + Text-to-Image (Editing): Provide an image and use the text prompt to add, remove, or modify elements, change the style, or adjust the color grading.

- Multi-Image to Image (Composition & style transfer): Use multiple input images to compose a new scene or transfer the style from one image to another.

- High-Fidelity text rendering: Accurately generate images that contain legible and well-placed text, ideal for logos, diagrams, and posters.
`),
          model: z
            .enum(["pro", "flash"])
            .describe(
              tr`

The Gemini model to use for image generation. How to choose the right model:

- choose "pro" to accurately generate images that contain legible and well-placed text, ideal for logos, diagrams, and posters. This model is designed for professional asset production and complex instructions
- choose "flash" for speed and efficiency. This model is optimized for high-volume, low-latency tasks.
`
            )
            .default("flash"),
          images: z
            .array(
              z.string().describe("An input image, specified as a VS path")
            )
            .describe("A list of input images, specified as VFS paths"),
          status_update: z.string().describe(tr`
A status update to show in the UI that provides more detail on the reason why this function was called.

For example, "Generating page 4 of the report" or "Combining the images into one"`),
          aspect_ratio: z
            .enum(["1:1", "9:16", "16:9", "4:3", "3:4"])
            .describe(`The aspect ratio for the generated images`)
            .default("16:9"),
        },
        response: {
          error: z
            .string()
            .describe(
              `If an error has occurred, will contain a description of the error`
            )
            .optional(),
          images: z
            .array(
              z.string().describe(`A generated image, specified as a VFS path`)
            )
            .describe(`Array of generated images`)
            .optional(),
        },
      },
      async (
        { prompt, images: inputImages, status_update, model, aspect_ratio },
        statusUpdater
      ) => {
        statusUpdater(status_update || "Generating Image(s)", {
          expectedDurationInSec: 50,
        });
        console.log("PROMPT", prompt);

        const imageParts = await fileSystem.getMany(inputImages);
        if (!ok(imageParts)) return { error: imageParts.$error };

        const modelName =
          model == "pro"
            ? "gemini-3-pro-image-preview"
            : "gemini-2.5-flash-image";

        const generated = await callGeminiImage(
          caps,
          moduleArgs,
          modelName,
          prompt,
          imageParts.map((part) => ({ parts: [part] })),
          true,
          aspect_ratio
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
          return { error: errors.join(",") };
        }
        return { images };
      }
    ),
    defineFunction(
      {
        name: GENERATE_TEXT_FUNCTION,
        description: `
An extremely versatile text generator, powered by Gemini. Use it for any tasks
that involve generation of text. Supports multimodal content input.`.trim(),
        parameters: {
          prompt: z.string().describe(tr`

Detailed prompt to use for text generation. The prompt may include references to VFS files. For instance, if you have an existing file at "/vfs/text3.md", you can reference it as <file src="/vfs/text3.md" /> in the prompt. If you do not use <file> tags, the text generator will not be able to access the file.

These references can point to files of any type, such as images, audio, videos, etc. Projects can also be referenced in this way.
`),
          model: z.enum(["pro", "flash", "lite"]).describe(tr`

The Gemini model to use for text generation. How to choose the right model:

- choose "pro" when reasoning over complex problems in code, math, and STEM, as well as analyzing large datasets, codebases, and documents using long context. Use this model only when dealing with exceptionally complex problems.
- choose "flash" for large scale processing, low-latency, high volume tasks that require thinking. This is the model you would use most of the time.
- choose "lite" for high throughput. Use this model when speed is paramount.

`),
          output_format: z.enum(["file", "text"]).describe(tr`

The output format. When "file" is specified, the output will be saved as a VFS file and the "file_path" response parameter will be provided as output. Use this when you expect a long output from the text generator. NOTE that choosing this option will prevent you from seeing the output directly: you only get back the VFS path to the file. You can read this file as a separate action, but if you do expect to read it, the "text" output format might be a better choice.

When "text" is specified, the output will be returned as text directlty, and the "text" response parameter will be provided.`),
          file_name: z
            .string()
            .describe(
              tr`

The name of the file to save the output to. This is the name that
will come after "/vfs/" prefix in the file path. Use snake_case for
naming. Only use when the "output_format" is set to "file".`
            )
            .optional(),
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
          url_context: z
            .boolean()
            .describe(
              tr`

Set to true to allow Gemini to retrieve context from URLs. Useful for tasks like the following:

- Extract Data: Pull specific info like prices, names, or key findings from multiple URLs.
- Compare Documents: Using URLs, analyze multiple reports, articles, or PDFs to identify differences and track trends.
- Synthesize & Create Content: Combine information from several source URLs to generate accurate summaries, blog posts, or reports.
- Analyze Code & Docs: Point to a GitHub repository or technical documentation URL to explain code, generate setup instructions, or answer questions.

Specify URLs in the prompt.

`
            )
            .optional(),
          status_update: z.string().describe(tr`
A status update to show in the UI that provides more detail on the reason why this function was called.

For example, "Researching the story" or "Writing a poem"`),
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
          url_context,
          project_path,
          output_format,
          status_update,
          file_name,
        },
        statusUpdater
      ) => {
        console.log("PROMPT", prompt);
        console.log("MODEL", model);
        console.log("SEARCH_GROUNDING", search_grounding);
        console.log("MAPS_GROUNDING", maps_grounding);
        console.log("PROJECT_PATH", project_path);
        console.log("OUTPUT_PATH", output_format);

        if (status_update) {
          statusUpdater(status_update);
        } else {
          if (search_grounding || maps_grounding) {
            statusUpdater("Researching");
          } else {
            statusUpdater("Generating Text");
          }
        }
        let tools: Tool[] | undefined = [];
        if (search_grounding) {
          tools.push({ googleSearch: {} });
        }
        if (maps_grounding) {
          tools.push({ googleMaps: {} });
        }
        if (url_context) {
          tools.push({ urlContext: {} });
        }
        let thinkingConfig: GenerationConfig = {};
        if (model === "pro") {
          thinkingConfig = {
            thinkingConfig: { includeThoughts: true, thinkingLevel: "high" },
          };
        }
        if (tools.length === 0) tools = undefined;
        const translated = await translator.fromPidginString(prompt);
        if (!ok(translated)) return { error: translated.$error };
        const body = await conformGeminiBody(moduleArgs, {
          systemInstruction: defaultSystemInstruction(),
          contents: [translated],
          tools,
          generationConfig: { ...thinkingConfig },
        });
        if (!ok(body)) return body;
        const resolvedModel = resolveTextModel(model);
        const results: TextCapabilityPart[] = [];
        let maxRetries = 5;
        do {
          const generating = await streamGenerateContent(
            resolvedModel,
            body,
            moduleArgs
          );
          if (!ok(generating)) {
            return { error: generating.$error };
          }
          for await (const chunk of generating) {
            const parts = chunk.candidates.at(0)?.content?.parts;
            if (!parts) continue;
            for (const part of parts) {
              if (!part || !("text" in part)) continue;
              if (part.thought) {
                statusUpdater(part.text, { isThought: true });
              } else {
                results.push(part);
              }
            }
          }
          if (results.length > 0) break;
          await new Promise((resolve) => setTimeout(resolve, RETRY_SLEEP_MS));
        } while (maxRetries-- > 0);
        statusUpdater(null);
        const textParts = mergeTextParts(results, "\n");
        if (textParts.length === 0) {
          return { error: `No text was generated. Please try again` };
        }
        if (textParts.length > 1) {
          console.warn(`More than one part generated`, results);
        }
        const part = textParts[0];
        const file_path = fileSystem.add(part, file_name);
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
          images: z
            .array(
              z
                .string()
                .describe("An reference input image, specified as a VS path")
            )
            .describe(
              "A list of input reference images, specified as VFS paths"
            ),
          status_update: z.string().describe(tr`
A status update to show in the UI that provides more detail on the reason why this function was called.

For example, "Making a marketing video" or "Creating the video concept"`),
          aspect_ratio: z
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
      async (
        { prompt, status_update, aspect_ratio, images },
        statusUpdateCallback
      ) => {
        console.log("PROMPT", prompt);
        console.log("ASPECT RATIO", aspect_ratio);
        statusUpdateCallback(status_update || "Generating Video", {
          expectedDurationInSec: 70,
        });
        const imageParts = await fileSystem.getMany(images);
        if (!ok(imageParts)) return { error: imageParts.$error };

        const generating = await callVideoGen(
          caps,
          moduleArgs,
          prompt,
          imageParts.map((part) => ({ parts: [part] })),
          false,
          aspect_ratio ?? "16:9",
          VIDEO_MODEL_NAME
        );
        if (!ok(generating)) {
          return {
            error: expandVeoError(generating, VIDEO_MODEL_NAME).$error,
          };
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
    defineFunction(
      {
        name: "generate_speech_from_text",
        description: "Generates speech from text",
        parameters: {
          text: z.string().describe("The verbatim text to turn into speech."),
          status_update: z.string().describe(tr`
A status update to show in the UI that provides more detail on the reason why this function was called.`),
          voice: z
            .enum(VOICES)
            .default("Female (English)")
            .describe("The voice to use for speech generation"),
        },
        response: {
          error: z
            .string()
            .describe(
              `If an error has occurred, will contain a description of the error`
            )
            .optional(),
          speech: z
            .string()
            .describe("Generated speech as a VFS file path")
            .optional(),
        },
      },
      async ({ text, status_update, voice }, statusUpdateCallback) => {
        statusUpdateCallback(status_update || "Generating Speech", {
          expectedDurationInSec: 20,
        });
        const generating = await callAudioGen(caps, moduleArgs, text, voice);
        if (!ok(generating)) return { error: generating.$error };

        const dataPart = generating.parts.at(0);
        if (!dataPart || !("storedData" in dataPart)) {
          return { error: `No speech was generated` };
        }
        const speech = fileSystem.add(dataPart);
        if (!ok(speech)) return { error: speech.$error };
        return { speech };
      }
    ),
    defineFunction(
      {
        name: "generate_music_from_text",
        description: tr`
Generates instrumental music and audio soundscapes based on the provided prompt.

To get your generated music closer to what you want, start with identifying your core musical idea and then refine your idea by adding keywords and modifiers.

The following elements should be considered for your prompt:

- Genre & Style: The primary musical category (e.g., electronic dance, classical, jazz, ambient) and stylistic characteristics (e.g., 8-bit, cinematic, lo-fi).
- Mood & Emotion: The desired feeling the music should evoke (e.g., energetic, melancholy, peaceful, tense).
- Instrumentation: Key instruments you want to hear (e.g., piano, synthesizer, acoustic guitar, string orchestra, electronic drums).
- Tempo & Rhythm: The pace (e.g., fast tempo, slow ballad, 120 BPM) and rhythmic character (e.g., driving beat, syncopated rhythm, gentle waltz).
- (Optional) Arrangement/Structure: How the music progresses or layers (e.g., starts with a solo piano, then strings enter, crescendo into a powerful chorus).
- (Optional) Soundscape/Ambiance: Background sounds or overall sonic environment (e.g., rain falling, city nightlife, spacious reverb, underwater feel).
- (Optional) Production Quality: Desired audio fidelity or recording style (e.g., high-quality production, clean mix, vintage recording, raw demo feel).

For example:

An energetic (mood) electronic dance track (genre) with a fast tempo (tempo) and a driving beat (rhythm), featuring prominent synthesizers (instrumentation) and electronic drums (instrumentation). High-quality production (production quality).	

A calm and dreamy (mood) ambient soundscape (genre/style) featuring layered synthesizers (instrumentation) and soft, evolving pads (instrumentation/arrangement). Slow tempo (tempo) with a spacious reverb (ambiance/production). Starts with a simple synth melody, then adds layers of atmospheric pads (arrangement).
`,
        parameters: {
          prompt: z
            .string()
            .describe(`The prompt from which to generate music`),
          status_update: z.string().describe(tr`
A status update to show in the UI that provides more detail on the reason why this function was called.`),
        },
        response: {
          error: z
            .string()
            .describe(
              `If an error has occurred, will contain a description of the error`
            )
            .optional(),
          music: z
            .string()
            .describe("Generated music as a VFS file path")
            .optional(),
        },
      },
      async ({ prompt, status_update }, statusUpdateCallback) => {
        statusUpdateCallback(status_update || "Generating Music", {
          expectedDurationInSec: 30,
        });
        const generating = await callMusicGen(caps, moduleArgs, prompt);
        if (!ok(generating)) return { error: generating.$error };

        const dataPart = generating.parts.at(0);
        if (!dataPart || !("storedData" in dataPart)) {
          return { error: `No speech was generated` };
        }
        const music = fileSystem.add(dataPart);
        if (!ok(music)) return { error: music.$error };
        return { music };
      }
    ),
    defineFunction(
      {
        name: "generate_and_execute_code",
        description: tr`
Generates and executes Python code, returning the result of execution.

The code is generated by a Gemini model, so a precise spec is all that's necessary in the prompt: Gemini will generate the actual code.

After it's generated, the code is immediately executed in a sandboxed environment that has access to the following libraries:

attrs
chess
contourpy
fpdf
geopandas
imageio
jinja2
joblib
jsonschema
jsonschema-specifications
lxml
matplotlib
mpmath
numpy
opencv-python
openpyxl
packaging
pandas
pillow
protobuf
pylatex
pyparsing
PyPDF2
python-dateutil
python-docx
python-pptx
reportlab
scikit-learn
scipy
seaborn
six
striprtf
sympy
tabulate
tensorflow
toolz
xlrd

Code execution works best with text and CSV files.

If the code environment generates an error, the model may decide to regenerate the code output. This can happen up to 5 times.

NOTE: The Python code execution environment has no access to the virtual file system (VFS), so don't use it to access or manipulate the VFS files.

        `,
        parameters: {
          spec: z.string().describe(tr`
Detailed spec for the code to generate. A spec can be in natural language or the exact Python code. 

When it's in natural language, the spec may include references to VFS files. For instance, if you have an existing file at "/vfs/text3.md", you can reference it as <file src="/vfs/text3.md" /> in the spec. If you do not use <file> tags, the code generator will not be able to access the file.

NOTE: The Python code execution environment has no access to the VFS. If you need to read or write files, you must use the natural language for the spec.

These references can point to files of any type, such as images, audio, videos, etc. Projects can also be referenced in this way.

`),
          search_grounding: z
            .boolean()
            .describe(
              tr`
Whether or not to use Google Search grounding. Grounding with Google Search
connects the code generation model to real-time web content and works with all available languages. This allows Gemini to power more complex use cases.`.trim()
            )
            .optional(),
          status_update: z.string().describe(tr`
A status update to show in the UI that provides more detail on the reason why this function was called.

For example, "Creating random values" or "Computing prime numbers"`),
        },
        response: {
          error: z
            .string()
            .describe(
              `If an error has occurred, will contain a description of the error`
            )
            .optional(),
          result: z
            .string()
            .describe(
              "The result of code execution as text that may contain VFS path references"
            )
            .optional(),
        },
      },
      async ({ spec, search_grounding, status_update }, statusUpdater) => {
        console.log("SPEC", spec);
        console.log("SEARCH_GROUNDING", search_grounding);

        if (status_update) {
          statusUpdater(status_update);
        } else {
          if (search_grounding) {
            statusUpdater("Researching");
          } else {
            statusUpdater("Generating Text");
          }
        }
        let tools: Tool[] | undefined = [];
        if (search_grounding) {
          tools.push({ googleSearch: {} });
        }
        tools.push({ codeExecution: {} });
        if (tools.length === 0) tools = undefined;
        const translated = await translator.fromPidginString(spec);
        if (!ok(translated)) return { error: translated.$error };
        const body = await conformGeminiBody(moduleArgs, {
          systemInstruction: defaultSystemInstruction(),
          contents: [translated],
          tools,
        });
        if (!ok(body)) return body;
        const results: TextCapabilityPart[] = [];
        let maxRetries = 5;
        do {
          const generating = await streamGenerateContent(
            resolveTextModel("flash"),
            body,
            moduleArgs
          );
          if (!ok(generating)) {
            return { error: generating.$error };
          }
          for await (const chunk of generating) {
            const parts = chunk.candidates.at(0)?.content?.parts;
            if (!parts) continue;
            for (const part of parts) {
              if (!part || !("text" in part)) continue;
              if (part.thought) {
                statusUpdater(part.text, { isThought: true });
              } else {
                results.push(part);
              }
            }
          }
          if (results.length > 0) break;
          console.log("WAITING TO RETRY");
          await new Promise((resolve) => setTimeout(resolve, RETRY_SLEEP_MS));
        } while (maxRetries-- > 0);
        statusUpdater(null);
        const textParts = mergeTextParts(results, "\n");
        if (textParts.length === 0) {
          return { error: `No text was generated. Please try again` };
        }
        if (textParts.length > 1) {
          console.warn(`More than one part generated`, results);
        }
        return { result: toText({ parts: textParts }) };
      }
    ),
  ];
}

function resolveTextModel(model: "pro" | "lite" | "flash"): string {
  switch (model) {
    case "pro":
      return "gemini-3-pro-preview";
    case "flash":
      return "gemini-3-flash-preview";
    default:
      return "gemini-2.5-lite";
  }
}
