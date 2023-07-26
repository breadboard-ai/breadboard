/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/graph-runner";
import { EmbedTextResponse, palm } from "@google-labs/palm-lite";

type EmbedStringInputs = {
  /**
   * Prompt for text completion.
   */
  text: string;
  /**
   * The Google Cloud Platform API key
   */
  API_KEY: string;
};

export default async (inputs: InputValues) => {
  const values = inputs as EmbedStringInputs;
  if (!values.API_KEY) throw new Error("Embedding requires `API_KEY` input");
  if (!values.text) throw new Error("Embedding requires `text` input");

  const request = palm(values.API_KEY).embedding({ text: values.text });
  const data = await fetch(request);
  const response = (await data.json()) as EmbedTextResponse;
  const embedding = response?.embedding?.value;
  return { embedding };
};
