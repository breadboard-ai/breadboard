/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "./components/main.js";
import type { Config } from "./config.js";

const config: Config = {};
const main = document.querySelector("bbrt-main");
if (main !== null) {
  main.config = config;
} else {
  console.error("could not find top-level <bbrt-main> element");
}
