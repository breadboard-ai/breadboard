/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "../types.js";
import { GenerateTextResponse, Text, palm } from "@google-labs/palm-lite";

type TextCompletionInputs = {
  /**
   * Prompt for text completion.
   */
  text: string;
  /**
   * The Google Cloud Platform API key
   */
  API_KEY: string;
  /**
   * Stop sequences
   */
  "stop-sequences": string[];
};

export default async (inputs: InputValues) => {
  const values = inputs as TextCompletionInputs;
  if (!values.API_KEY)
    throw new Error("Text completion requires `API_KEY` input");
  if (!values.text) throw new Error("Text completion requires `text` input");

  const prompt = new Text().text(values.text);
  const stopSequences = values["stop-sequences"] || [];
  stopSequences.forEach((stopSequence) => prompt.addStopSequence(stopSequence));
  const request = palm(values.API_KEY).text(prompt);
  const data = await fetch(request);
  const response = (await data.json()) as GenerateTextResponse;
  const completion = response?.candidates?.[0]?.output as string;
  return { completion };
};
