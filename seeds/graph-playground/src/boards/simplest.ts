/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const simplest = new Board();
const kit = simplest.addKit(Starter);

const completion = kit.generateText();
kit.secrets(["PALM_KEY"]).wire("PALM_KEY", completion);
simplest
  .input()
  .wire("text", completion.wire("completion->text", simplest.output()));

export default simplest;
