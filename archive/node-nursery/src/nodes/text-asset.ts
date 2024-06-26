/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/breadboard";
import * as fs from "fs";

export default async (inputs: InputValues) => {
  const f = fs.readFileSync(inputs.filename as string, "utf8");
  return await { text: f };
};
