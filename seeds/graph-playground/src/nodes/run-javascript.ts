/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "../graph.js";

// https://regex101.com/r/PeEmEW/1
const stripCodeBlock = (code: string) =>
  code.replace(/(?:```(?:js|javascript)?\n+)(.*)(?:\n+```)/gms, "$1");

export default async (inputs?: InputValues) => {
  if (!inputs) throw new Error("Running JavaScript requires inputs");
  const code = inputs["code"] as string;
  if (!code) throw new Error("Running JavaScript requires code");
  const clean = stripCodeBlock(code);
  return { result: String(eval(`${clean}\ncompute();`)) };
};
