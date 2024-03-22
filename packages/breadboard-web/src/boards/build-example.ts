/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board } from "@google-labs/breadboard";
import { buildExampleKit } from "../build-example-kit.js";

export default await board(({ word }) => {
  const { backwards } = buildExampleKit.reverseString({
    forwards: word.isString(),
  });

  const { result } = buildExampleKit.templater({
    template: `The word "{{forwards}}" is "{{backwards}}" in reverse.`,
    forwards: word.isString(),
    backwards: backwards.isString(),
  });

  return { result };
}).serialize({
  title: "Build example",
  description: "An example that uses a kit created with @breadboard-ai/build",
  version: "0.0.1",
});
