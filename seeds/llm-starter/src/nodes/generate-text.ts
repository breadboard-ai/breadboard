/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeValue,
  OutputValues,
  ErrorCapability,
  NodeDescriberFunction,
  NodeHandler,
} from "@google-labs/breadboard";
import {
  GenerateTextResponse,
  SafetySetting,
  Text,
  palm,
} from "@google-labs/palm-lite";

export type GenerateTextOutputs = GenerateTextResponse & {
  completion: string;
};

export type GenerateTextInputs = NodeValue & {
  /**
   * Prompt for text completion.
   */
  text: string;
  /**
   * The Google Cloud Platform API key
   */
  PALM_KEY: string;
  /**
   * Stop sequences
   */
  stopSequences: string[];
  /**
   * Safety settings
   */
  safetySettings: SafetySetting[];
};

export type GenerateTextError = ErrorCapability & {
  inputs: GenerateTextInputs;
  filters: GenerateTextResponse["filters"];
  safetyFeedback: GenerateTextResponse["safetyFeedback"];
};

export const prepareRequest = (inputs: InputValues) => {
  const values = inputs as GenerateTextInputs;
  if (!values.PALM_KEY)
    throw new Error("Text completion requires `PALM_KEY` input");
  if (!values.text) throw new Error("Text completion requires `text` input");

  const prompt = new Text().text(values.text);
  const stopSequences = values.stopSequences || [];
  stopSequences.forEach((stopSequence) => prompt.addStopSequence(stopSequence));
  const safetySettings = values.safetySettings || [];
  safetySettings.forEach((safetySetting) =>
    prompt.addSafetySetting(safetySetting.category, safetySetting.threshold)
  );
  return palm(values.PALM_KEY).text(prompt);
};

export const prepareResponse = async (
  data: Response
): Promise<OutputValues> => {
  const json = await data.json();
  const response = json as GenerateTextResponse;

  const completion = response?.candidates?.[0]?.output as string;
  if (completion) return { completion, ...json };
  else
    return {
      $error: {
        kind: "error",
        error: new Error(
          "Palm generateText failed: " +
            (data.ok ? JSON.stringify(json) : data.statusText)
        ),
        status: data.status,
        ...json,
      } as GenerateTextError,
    } as OutputValues;
};

export const generateTextDescriber: NodeDescriberFunction = async () => {
  return {
    inputSchema: {
      type: "object",
      properties: {
        text: {
          title: "text",
          description: "Prompt for text completion.",
          type: "string",
        },
        PALM_KEY: {
          title: "PALM_KEY",
          description: "The Google Cloud Platform API key",
          type: "string",
        },
        stopSequences: {
          title: "stopSequences",
          description: "Stop sequences",
          type: "array",
          items: {
            type: "string",
          },
        },
        safetySettings: {
          title: "safetySettings",
          description: "Safety settings",
          type: "array",
          items: {
            type: "object",
            required: ["category", "threshold"],
          },
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        completion: {
          title: "completion",
          description:
            "The generated text completion of the supplied text input.",
          type: "string",
        },
        $error: {
          title: "$error",
          description: "Error information, if any.",
          type: "object",
        },
      },
    },
  };
};

export default {
  describe: generateTextDescriber,
  invoke: async (inputs: InputValues) => {
    return await prepareResponse(await fetch(prepareRequest(inputs)));
  },
} satisfies NodeHandler;
