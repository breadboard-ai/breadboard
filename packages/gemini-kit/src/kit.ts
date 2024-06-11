/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";

import geminiGenerator from "./boards/gemini-generator.js";
import geminiFile from "./boards/gemini-file.js";
import geminiProVision from "./boards/gemini-pro-vision.js";
import nanoGenerator from "./boards/nano-generator.js";

import { Core } from "@google-labs/core-kit";
import { serialize } from "@breadboard-ai/build";

// TODO: Convert to new syntax
const kit = new Board({
  title: "Gemini API Kit",
  description:
    "This board is actually a kit: a collection of nodes for working with the Gemini API.",
  version: "0.0.1",
});
const core = kit.addKit(Core);

kit.graphs = {
  text: serialize(geminiGenerator),
  file: serialize(geminiFile),
  vision: geminiProVision,
  nano: serialize(nanoGenerator),
};

core.invoke({ $id: "file", $board: "#file" });
core.invoke({ $id: "text", $board: "#text" });
core.invoke({ $id: "vision", $board: "#vision" });
core.invoke({ $id: "nano", $board: "#nano", $metadata: { icon: "nano" } });

export default kit;
