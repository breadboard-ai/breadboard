/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConsentType, TextCapabilityPart } from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import z from "zod";
import { GenerationConfig, Tool } from "../../a2/gemini.js";
import { type ExecuteStepArgs } from "../../a2/step-executor.js";
import { A2ModuleArgs } from "../../runnable-module-factory.js";
import { AgentFileSystem } from "../file-system.js";
import {
  defineFunction,
  FunctionDefinition,
  mapDefinitions,
} from "../function-definition.js";
import { defaultSystemInstruction } from "../../generate-text/system-instruction.js";
import {
  llm,
  mergeContent,
  mergeTextParts,
  toText,
  tr,
} from "../../a2/utils.js";
import { expandVeoError } from "../../video-generator/main.js";
import { VOICES } from "../../audio-generator/main.js";
import { PidginTranslator } from "../pidgin-translator.js";
import { FunctionGroup, Generators } from "../types.js";
import { fileNameSchema, statusUpdateSchema, taskIdSchema } from "./system.js";
import { TaskTreeManager } from "../task-tree-manager.js";
import { createReporter } from "../progress-work-item.js";
import type { AgentEventSink } from "../agent-event-sink.js";

export { getGenerateFunctionGroup, GENERATE_TEXT_FUNCTION };

const VIDEO_MODEL_NAME = "veo-3.1-generate-preview";

const FLASH_MODEL_NAME = "gemini-3-flash-preview";
const CODE_GENERATION_MODEL_NAME = "gemini-3-flash-preview";
const PRO_MODEL_NAME = "gemini-3-pro-preview";
const LITE_MODEL_NAME = "gemini-2.5-flash-lite";

const IMAGE_FLASH_MODEL_NAME = "gemini-2.5-flash-image";
const IMAGE_PRO_MODEL_NAME = "gemini-3-pro-image-preview";

export type ModelConstraint =
  | "none"
  | "text-flash"
  | "text-pro"
  | "image"
  | "video"
  | "speech"
  | "music";

export type GenerateFunctionArgs = {
  fileSystem: AgentFileSystem;
  moduleArgs: A2ModuleArgs;
  translator: PidginTranslator;
  taskTreeManager: TaskTreeManager;
  generators: Generators;
  sink: AgentEventSink;
};

const GENERATE_TEXT_FUNCTION = "generate_text";
const GENERATE_AND_EXECUTE_CODE_FUNCTION = "generate_and_execute_code";

const instruction = tr`

## When to call "${GENERATE_TEXT_FUNCTION}" function

When evaluating the objective, make sure to determine whether calling "${GENERATE_TEXT_FUNCTION}" function is warranted. The key tradeoff here is latency: because it's an additional model call, the "generate_text" will take longer to finish.

Your job is to fulfill the objective as efficiently as possible, so weigh the need to invoke "${GENERATE_TEXT_FUNCTION}" carefully.

Here is the rules of thumb:

- For shorter responses like a chat conversation, just do the text generation yourself. You are an LLM and you can do it without calling "${GENERATE_TEXT_FUNCTION}" function.
- For longer responses like generating a chapter of a book or analyzing a large and complex set of files, use "${GENERATE_TEXT_FUNCTION}" function.


### How to write a good prompt for the code generator

The "${GENERATE_AND_EXECUTE_CODE_FUNCTION}" function is a self-contained code generator with a sandboxed code execution environment. Think of it as a sub-agent that both generates the code and executes it, then provides the result. This sub-agent takes a natural language prompt to do its job.

A good code generator prompt will include the following components:

1. Preference for the Python library to use. For example "Use the reportlab library to generate PDF"

2. What to consume as input. Focus on the "what", rather than the "how". When binary files are passed as input, use the key words "use provided file". Do NOT refer to file paths, see below.

3. The high-level approach to solving the problem with code. If applicable, specify algorithms or techniques to use.

4. What to deliver as output. Again, do not worry about the "how", instead specify the "what". For text files, use the key word "return" in the prompt. For binary files, use the key word word "save". For example, "Return the resulting number" or "Save the PDF file" or "Save all four resulting images". Do NOT ask to name the files, see below.

The code generator prompt may include references to files and it may output references to files. However, theses references are translated at the boundary of the sandboxed code execution environment into actual files and file handles that will be different from what you specify. The Python code execution environment has no access to your file system.

Because of this translation layer, DO NOT mention file system paths or file references in the prompt outside of the <file> tag.

For example, if you need to include  an existing file at "/mnt/text3.md" into the prompt, you can reference it as <file src="/mnt/text3.md" />. If you do not use <file> tags, the code generator will not be able to access the file.

For output, do not ask the code generator to name the files. It will assign its own file names names to save in the sandbox, and these will be picked up at the sandbox boundary and translated into <file> tags for you.
`;

function getGenerateFunctionGroup(args: GenerateFunctionArgs): FunctionGroup {
  return { ...mapDefinitions(defineGenerateFunctions(args)), instruction };
}

function defineGenerateFunctions(
  args: GenerateFunctionArgs
): FunctionDefinition[] {
  const {
    fileSystem,
    moduleArgs,
    translator,
    taskTreeManager,
    generators,
    sink,
  } = args;
  const imageFunction = defineFunction(
    {
      name: "generate_images",
      icon: "photo_spark",
      title: "Generating Image(s)",
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
          .array(z.string().describe("An input image, specified as a VS path"))
          .describe("A list of input images, specified as file paths"),
        aspect_ratio: z
          .enum(["1:1", "9:16", "16:9", "4:3", "3:4"])
          .describe(`The aspect ratio for the generated images`)
          .default("16:9"),
        ...fileNameSchema,
        ...taskIdSchema,
        ...statusUpdateSchema,
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
            z.string().describe(`A generated image, specified as a file path`)
          )
          .describe(`Array of generated images`)
          .optional(),
      },
    },
    async (
      {
        prompt,
        images: inputImages,
        status_update,
        model,
        aspect_ratio,
        file_name,
        task_id,
      },
      statusUpdater,
      reporter
    ) => {
      taskTreeManager.setInProgress(task_id, status_update);
      statusUpdater(status_update || "Generating Image(s)", {
        expectedDurationInSec: 50,
      });

      const imageParts = await fileSystem.getMany(inputImages);
      if (!ok(imageParts)) return { error: imageParts.$error };

      const modelName =
        model == "pro" ? IMAGE_PRO_MODEL_NAME : IMAGE_FLASH_MODEL_NAME;

      // Use provided reporter if available, otherwise create one
      const effectiveReporter =
        reporter ??
        createReporter(moduleArgs, {
          title: `Generating Image(s)`,
          icon: "photo_spark",
        });
      const args: ExecuteStepArgs = {
        ...moduleArgs,
        reporter: effectiveReporter,
      };
      const generated = await generators.callImage(
        args,
        modelName,
        prompt,
        imageParts.map((part) => ({ parts: [part] })),
        true,
        aspect_ratio
      );
      if (!ok(generated)) return { error: generated.$error };
      const errors: string[] = [];
      const parts = mergeContent(generated, "user").parts;
      const images = parts
        .map((part, index) => {
          const name =
            file_name && parts.length > 1
              ? `${file_name}_${index + 1}`
              : file_name;
          return fileSystem.add(part, name);
        })
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
  );
  const textFunction = defineFunction(
    {
      name: GENERATE_TEXT_FUNCTION,
      icon: "text_analysis",
      title: "Generating Text",
      description: `
An extremely versatile text generator, powered by Gemini. Use it for any tasks
that involve generation of text. Supports multimodal content input.`.trim(),
      parameters: {
        prompt: z.string().describe(tr`

Detailed prompt to use for text generation. The prompt may include references to files. For instance, if you have an existing file at "/mnt/text3.md", you can reference it as <file src="/mnt/text3.md" /> in the prompt. If you do not use <file> tags, the text generator will not be able to access the file.

These references can point to files of any type, such as images, audio, videos, etc.
`),
        model: z.enum(["pro", "flash", "lite"]).describe(tr`

The Gemini model to use for text generation. How to choose the right model:

- choose "pro" when reasoning over complex problems in code, math, and STEM, as well as analyzing large datasets, codebases, and documents using long context. Use this model only when dealing with exceptionally complex problems.
- choose "flash" for large scale processing, low-latency, high volume tasks that require thinking. This is the model you would use most of the time.
- choose "lite" for high throughput. Use this model when speed is paramount.

`),
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
        ...taskIdSchema,
        ...statusUpdateSchema,
      },
      response: {
        error: z
          .string()
          .describe(
            `If an error has occurred, will contain a description of the error`
          )
          .optional(),
        text: z
          .string()
          .describe(`The output of the text generator.`)
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
        status_update,
        task_id,
      },
      statusUpdater
    ) => {
      taskTreeManager.setInProgress(task_id, status_update);
      if (status_update) {
        statusUpdater(status_update, { expectedDurationInSec: 20 });
      } else {
        if (search_grounding || maps_grounding) {
          statusUpdater("Researching", { expectedDurationInSec: 30 });
        } else {
          statusUpdater("Generating Text", { expectedDurationInSec: 20 });
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
        const consent = await sink.suspend<boolean>({
          type: "queryConsent",
          requestId: crypto.randomUUID(),
          consentType: ConsentType.GET_ANY_WEBPAGE,
          scope: {},
          graphUrl: moduleArgs.context.currentGraph?.url || "",
        });
        if (!consent) {
          return { error: "User declined to consent to access URLs" };
        }
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
      const body = await generators.conformBody(moduleArgs, {
        systemInstruction: defaultSystemInstruction(),
        contents: [translated],
        tools,
        generationConfig: { ...thinkingConfig },
      });
      if (!ok(body)) return body;
      const resolvedModel = resolveTextModel(model);
      const results: TextCapabilityPart[] = [];
      const generating = await generators.streamContent(
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
      statusUpdater(null);
      const textParts = mergeTextParts(results);
      if (textParts.length === 0) {
        return { error: `No text was generated. Please try again` };
      }
      return { text: translator.contentToPidginString({ parts: textParts }) };
    }
  );
  const videoFunction = defineFunction(
    {
      name: "generate_video",
      icon: "videocam_auto",
      title: "Generating Video",
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
              .describe("A reference input image, specified as a VS path")
          )
          .describe(
            "A list of input reference images, specified as file paths. Use reference images only when you need to start with a particular image."
          )
          .optional(),
        aspect_ratio: z
          .enum(["16:9", "9:16"])
          .describe(`The aspect ratio of the video`)
          .default("16:9"),
        ...fileNameSchema,
        ...taskIdSchema,
        ...statusUpdateSchema,
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
          .describe(`Generated video, specified as file path`)
          .optional(),
      },
    },
    async (
      { prompt, status_update, aspect_ratio, images, file_name, task_id },
      statusUpdateCallback,
      reporter
    ) => {
      taskTreeManager.setInProgress(task_id, status_update);
      statusUpdateCallback(status_update || "Generating Video", {
        expectedDurationInSec: 70,
      });
      const imageParts = await fileSystem.getMany(images || []);
      if (!ok(imageParts)) return { error: imageParts.$error };

      const effectiveReporter =
        reporter ??
        createReporter(moduleArgs, {
          title: `Generating Video`,
          icon: "videocam_auto",
        });
      const args: ExecuteStepArgs = {
        ...moduleArgs,
        reporter: effectiveReporter,
      };
      const generating = await generators.callVideo(
        args,
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
      const video = fileSystem.add(dataPart, file_name);
      if (!ok(video)) {
        return { error: video.$error };
      }
      return { video };
    }
  );
  const speechFunction = defineFunction(
    {
      name: "generate_speech_from_text",
      icon: "audio_magic_eraser",
      title: "Generating Speech",
      description: "Generates speech from text",
      parameters: {
        text: z.string().describe("The verbatim text to turn into speech."),
        voice: z
          .enum(VOICES)
          .default("Female (English)")
          .describe("The voice to use for speech generation"),
        ...fileNameSchema,
        ...taskIdSchema,
        ...statusUpdateSchema,
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
          .describe("Generated speech as a file path")
          .optional(),
      },
    },
    async (
      { text, status_update, voice, file_name, task_id },
      statusUpdateCallback,
      reporter
    ) => {
      taskTreeManager.setInProgress(task_id, status_update);
      statusUpdateCallback(status_update || "Generating Speech", {
        expectedDurationInSec: 20,
      });
      const effectiveReporter =
        reporter ??
        createReporter(moduleArgs, {
          title: `Generating Speech`,
          icon: "audio_magic_eraser",
        });
      const args: ExecuteStepArgs = {
        ...moduleArgs,
        reporter: effectiveReporter,
      };
      const generating = await generators.callAudio(args, text, voice);
      if (!ok(generating)) return { error: generating.$error };

      const dataPart = generating.parts.at(0);
      if (!dataPart || !("storedData" in dataPart)) {
        return { error: `No speech was generated` };
      }
      const speech = fileSystem.add(dataPart, file_name);
      if (!ok(speech)) return { error: speech.$error };
      return { speech };
    }
  );
  const musicFunction = defineFunction(
    {
      name: "generate_music_from_text",
      icon: "audio_magic_eraser",
      title: "Generating Music",
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
        prompt: z.string().describe(`The prompt from which to generate music`),
        ...fileNameSchema,
        ...taskIdSchema,
        ...statusUpdateSchema,
      },
      response: {
        error: z
          .string()
          .describe(
            `If an error has occurred, will contain a description of the error`
          )
          .optional(),
        music: z.string().describe("Generated music as a file path").optional(),
      },
    },
    async (
      { prompt, status_update, file_name, task_id },
      statusUpdateCallback,
      reporter
    ) => {
      taskTreeManager.setInProgress(task_id, status_update);
      statusUpdateCallback(status_update || "Generating Music", {
        expectedDurationInSec: 30,
      });
      const effectiveReporter =
        reporter ??
        createReporter(moduleArgs, {
          title: `Generating Music`,
          icon: "audio_magic_eraser",
        });
      const args: ExecuteStepArgs = {
        ...moduleArgs,
        reporter: effectiveReporter,
      };
      const generating = await generators.callMusic(args, prompt);
      if (!ok(generating)) return { error: generating.$error };

      const dataPart = generating.parts.at(0);
      if (!dataPart || !("storedData" in dataPart)) {
        return { error: `No speech was generated` };
      }
      const music = fileSystem.add(dataPart, file_name);
      if (!ok(music)) return { error: music.$error };
      return { music };
    }
  );
  const codeFunction = defineFunction(
    {
      name: GENERATE_AND_EXECUTE_CODE_FUNCTION,
      icon: "code",
      title: "Generating and Executing Code",
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

NOTE: The Python code execution environment has no access to your file system, so don't use it to access or manipulate your files.

        `,
      parameters: {
        prompt: z.string().describe(tr`
Detailed prompt for the code to generate. DO NOT write Python code as the prompt. Instead DO use the natural language. This will let the code generator within this tool make the best decisions on what code to write. Your job is not to write code, but to direct the code generator.

The prompt may include references to files as <file> tags. They will be correctly marshalled across the sandbox boundary.
`),
        search_grounding: z
          .boolean()
          .describe(
            tr`
Whether or not to use Google Search grounding. Grounding with Google Search
connects the code generation model to real-time web content and works with all available languages. This allows Gemini to power more complex use cases.`.trim()
          )
          .optional(),
        ...statusUpdateSchema,
        ...taskIdSchema,
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
            "The result of code execution as text that may contain file path references"
          )
          .optional(),
      },
    },
    async (
      { prompt, search_grounding, status_update, task_id },
      statusUpdater
    ) => {
      taskTreeManager.setInProgress(task_id, status_update);
      if (status_update) {
        statusUpdater(status_update, { expectedDurationInSec: 40 });
      } else {
        if (search_grounding) {
          statusUpdater("Researching", { expectedDurationInSec: 50 });
        } else {
          statusUpdater("Generating Code", { expectedDurationInSec: 40 });
        }
      }
      let tools: Tool[] | undefined = [];
      if (search_grounding) {
        tools.push({ googleSearch: {} });
      }
      tools.push({ codeExecution: {} });
      if (tools.length === 0) tools = undefined;

      const translated = await translator.fromPidginString(prompt);
      if (!ok(translated)) return { error: translated.$error };
      const body = await generators.conformBody(moduleArgs, {
        systemInstruction: llm`${tr`

Your job is to generate and execute code to fulfill your objective.

You are working as part of an AI system, so no chit-chat and no explaining what you're doing and why.
DO NOT start with "Okay", or "Alright" or any preambles. Just the output, please.

`}`.asContent(),
        contents: [translated],
        tools,
      });
      if (!ok(body)) return body;
      const results: TextCapabilityPart[] = [];
      const generating = await generators.streamContent(
        CODE_GENERATION_MODEL_NAME,
        body,
        moduleArgs
      );
      if (!ok(generating)) {
        return { error: generating.$error };
      }
      let lastCodeExecutionError: string | null = null;
      for await (const chunk of generating) {
        const parts = chunk.candidates.at(0)?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (!part) continue;
          if ("text" in part) {
            if (part.thought) {
              statusUpdater(part.text, { isThought: true });
            } else {
              results.push(part);
            }
          } else if ("inlineData" in part) {
            // File result
            const file = fileSystem.add(part);
            if (!ok(file)) {
              return {
                error: `Code generation failed due to invalid file output.`,
              };
            }
            results.push({ text: `<file src="${file}" />` });
          } else if ("codeExecutionResult" in part) {
            const { outcome, output } = part.codeExecutionResult;
            if (outcome !== "OUTCOME_OK") {
              lastCodeExecutionError = output;
            } else {
              lastCodeExecutionError = null;
            }
          }
        }
      }

      if (lastCodeExecutionError) {
        return {
          error: `The code generator tried and failed with the following error:\n\n${lastCodeExecutionError}`,
        };
      }
      statusUpdater(null);
      const textParts = mergeTextParts(results);
      if (textParts.length === 0) {
        return { error: `No text was generated. Please try again` };
      }
      if (textParts.length > 1) {
        console.warn(`More than one part generated`, results);
      }
      return { result: toText({ parts: textParts }) };
    }
  );

  return [
    imageFunction,
    textFunction,
    videoFunction,
    speechFunction,
    musicFunction,
    codeFunction,
  ];
}

function resolveTextModel(model: "pro" | "lite" | "flash"): string {
  switch (model) {
    case "pro":
      return PRO_MODEL_NAME;
    case "flash":
      return FLASH_MODEL_NAME;
    default:
      return LITE_MODEL_NAME;
  }
}
