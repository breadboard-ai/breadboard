/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "../graph.js";
import { GenerateTextResponse, Text, palm } from "@google-labs/palm-lite";
import { config } from "dotenv";

config();

const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error("API_KEY not set");

export default async (inputs?: InputValues) => {
  if (!inputs) throw new Error("Text completion requires inputs");
  // const s = spinner();
  // How to move these outside of the handler?
  // These need to be part of the outer machinery, but also not in the actual
  // follow logic.
  // My guess is I am seeing some sort of lifecycle situation here?
  // s.start("Generating text completion");
  const prompt = new Text().text(inputs["text"] as string);
  const stopSequences = (inputs["stop-sequences"] as string[]) || [];
  stopSequences.forEach((stopSequence) => prompt.addStopSequence(stopSequence));
  const request = palm(API_KEY).text(prompt);
  const data = await fetch(request);
  const response = (await data.json()) as GenerateTextResponse;
  // s.stop("Text completion generated");
  const completion = response?.candidates?.[0]?.output as string;
  return { completion };
};
