/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";

import geminiGenerator from "./boards/gemini-generator.js";
import geminiProVision from "./boards/gemini-pro-vision.js";

import { Core } from "@google-labs/core-kit";

// TODO: Convert to new syntax
const kit = new Board({
  title: "Gemini API Kit",
  description:
    "This board is actually a kit: a collection of nodes for working with the Gemini API.",
  version: "0.0.1",
});
const core = kit.addKit(Core);

kit.graphs = {
  text: geminiGenerator,
  vision: geminiProVision,
};

core.invoke({ $id: "text", path: "#text" });
core.invoke({ $id: "vision", path: "#vision" });

export default kit;
