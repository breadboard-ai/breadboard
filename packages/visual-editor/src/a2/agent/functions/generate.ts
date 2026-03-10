/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ConsentType,
  ErrorMetadata,
  TextCapabilityPart,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { GenerationConfig, Tool } from "../../a2/gemini.js";
import { type ExecuteStepArgs } from "../../a2/step-executor.js";
import { A2ModuleArgs } from "../../runnable-module-factory.js";
import { AgentFileSystem } from "../file-system.js";
import { assembleFunctionGroup } from "../function-definition.js";
import { defaultSystemInstruction } from "../../generate-text/system-instruction.js";
import {
  llm,
  mergeContent,
  mergeTextParts,
  toText,
  tr,
} from "../../a2/utils.js";
import { expandVeoError } from "../../video-generator/main.js";
import { PidginTranslator } from "../pidgin-translator.js";
import { FunctionGroup, Generators } from "../types.js";
import { TaskTreeManager } from "../task-tree-manager.js";
import { createReporter } from "../progress-work-item.js";
import type { AgentEventSink } from "../agent-event-sink.js";
import { decodeErrorData } from "../../../sca/utils/decode-error.js";

import {
  declarations,
  metadata,
  instruction,
  type GenerateImagesParams,
  type GenerateTextParams,
  type GenerateVideoParams,
  type GenerateSpeechFromTextParams,
  type GenerateMusicFromTextParams,
  type GenerateAndExecuteCodeParams,
} from "./generated/generate.js";

export { getGenerateFunctionGroup, GENERATE_TEXT_FUNCTION };

const GENERATE_TEXT_FUNCTION = "generate_text";

const VIDEO_MODEL_NAME = "veo-3.1-generate-preview";

const FLASH_MODEL_NAME = "gemini-3-flash-preview";
const CODE_GENERATION_MODEL_NAME = "gemini-3-flash-preview";
const PRO_MODEL_NAME = "gemini-3.1-pro-preview";
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

function getGenerateFunctionGroup(args: GenerateFunctionArgs): FunctionGroup {
  const {
    fileSystem,
    moduleArgs,
    translator,
    taskTreeManager,
    generators,
    sink,
  } = args;

  return assembleFunctionGroup(declarations, metadata, instruction, {
    generate_images: async (
      {
        prompt,
        images: inputImages,
        status_update,
        model,
        aspect_ratio,
        file_name,
        task_id,
      }: GenerateImagesParams,
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
      const execArgs: ExecuteStepArgs = {
        ...moduleArgs,
        reporter: effectiveReporter,
      };
      const generated = await generators.callImage(
        execArgs,
        modelName,
        prompt,
        imageParts.map((part) => ({ parts: [part] })),
        true,
        aspect_ratio
      );
      if (!ok(generated)) return toErrorOrResponse(generated);
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
    },

    generate_text: async (
      {
        prompt,
        model,
        search_grounding,
        maps_grounding,
        url_context,
        status_update,
        task_id,
      }: GenerateTextParams,
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
          queryConsent: {
            requestId: crypto.randomUUID(),
            consentType: ConsentType.GET_ANY_WEBPAGE,
            scope: {},
            graphUrl: moduleArgs.context.currentGraph?.url || "",
          },
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
      if (!ok(generating)) return toErrorOrResponse(generating);
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
    },

    generate_video: async (
      {
        prompt,
        status_update,
        aspect_ratio,
        images,
        file_name,
        task_id,
      }: GenerateVideoParams,
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
      const execArgs: ExecuteStepArgs = {
        ...moduleArgs,
        reporter: effectiveReporter,
      };
      const generating = await generators.callVideo(
        execArgs,
        prompt,
        imageParts.map((part) => ({ parts: [part] })),
        false,
        aspect_ratio ?? "16:9",
        VIDEO_MODEL_NAME
      );
      if (!ok(generating))
        return toErrorOrResponse(expandVeoError(generating, VIDEO_MODEL_NAME));
      const dataPart = generating.parts.at(0);
      if (!dataPart || !("storedData" in dataPart)) {
        return { error: `No video was generated` };
      }
      const video = fileSystem.add(dataPart, file_name);
      if (!ok(video)) {
        return { error: video.$error };
      }
      return { video };
    },

    generate_speech_from_text: async (
      {
        text,
        status_update,
        voice,
        file_name,
        task_id,
      }: GenerateSpeechFromTextParams,
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
      const execArgs: ExecuteStepArgs = {
        ...moduleArgs,
        reporter: effectiveReporter,
      };
      const generating = await generators.callAudio(execArgs, text, voice);
      if (!ok(generating)) return toErrorOrResponse(generating);

      const dataPart = generating.parts.at(0);
      if (!dataPart || !("storedData" in dataPart)) {
        return { error: `No speech was generated` };
      }
      const speech = fileSystem.add(dataPart, file_name);
      if (!ok(speech)) return { error: speech.$error };
      return { speech };
    },

    generate_music_from_text: async (
      {
        prompt,
        status_update,
        file_name,
        task_id,
      }: GenerateMusicFromTextParams,
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
      const execArgs: ExecuteStepArgs = {
        ...moduleArgs,
        reporter: effectiveReporter,
      };
      const generating = await generators.callMusic(execArgs, prompt);
      if (!ok(generating)) return toErrorOrResponse(generating);

      const dataPart = generating.parts.at(0);
      if (!dataPart || !("storedData" in dataPart)) {
        return { error: `No speech was generated` };
      }
      const music = fileSystem.add(dataPart, file_name);
      if (!ok(music)) return { error: music.$error };
      return { music };
    },

    generate_and_execute_code: async (
      {
        prompt,
        search_grounding,
        status_update,
        task_id,
      }: GenerateAndExecuteCodeParams,
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
      if (!ok(generating)) return toErrorOrResponse(generating);
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
    },
  });
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

/**
 * Error kinds that should immediately terminate the agent loop rather than
 * being sent back to the LLM as a function response. Quota-exhausted errors
 * are unrecoverable — retrying would just hit the same wall, and the UI
 * provides special treatment for them, so we don't want the agent to re-
 * interpret the error, but rather return it to the system directly.
 */
const FATAL_KINDS: ReadonlySet<string> = new Set([
  "free-quota-exhausted",
  "free-quota-exhausted-can-pay",
  "paid-quota-exhausted",
]);

/**
 * Classifies a generation error and decides whether to break the agent loop
 * or let the LLM retry.
 *
 * When a generation function (image, video, text, etc.) fails, the error
 * string may contain structured JSON (e.g. RESOURCE_EXHAUSTED) that
 * `decodeErrorData` can classify. If the error is fatal (quota exhausted),
 * this returns `err()` — an Outcome error that propagates up through
 * `FunctionCallerImpl.getResults()` and causes the loop to exit. Otherwise,
 * it returns `{ error: ... }` — a successful function response that the LLM
 * sees and can decide how to handle (retry, report to user, etc.).
 */
function toErrorOrResponse(error: {
  $error: string;
  metadata?: ErrorMetadata;
}): { error: string } | { $error: string; metadata?: ErrorMetadata } {
  const decoded = decodeErrorData(error.$error, error.metadata);
  if (decoded.metadata?.kind && FATAL_KINDS.has(decoded.metadata.kind)) {
    return error;
  }
  return { error: error.$error };
}
