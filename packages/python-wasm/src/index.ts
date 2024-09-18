/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { kit } from "@breadboard-ai/build";
import { runPython } from "./run-python.js";

export default await kit({
  title: "Python Wasm Kit",
  description: "An example kit",
  version: "0.1.0",
  url: "npm:@breadboard-ai/python-wasm",
  components: { runPython },
});
