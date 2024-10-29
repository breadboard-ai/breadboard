/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "node:fs/promises";
import path from "node:path";

/**
 *
 * @param {string} dir
 * @param {string} graphFile
 */
export function createModuleDirectoryName(dir, graphFile) {
  return path.join(dir, `${graphFile}_modules`);
}

export function parseModuleDirectoryName(dir) {
  let [boardName, module] = dir.split(path.sep);

  boardName = boardName.replace(/_modules$/, "");
  module = module.replace(path.extname(module), "");

  return { boardName, module };
}

export function createModuleDescription(module) {
  if (!module.metadata.description) {
    return "";
  }

  return `/**
 * @fileOverview
${module.metadata.description.split("\n").map((line) => ` * ${line}`)}
 */`;
}

export function parseModuleDescription(module) {
  const matches = /@fileOverview([\s\S]*?)\*\//gim.exec(module);
  if (!matches) {
    return "";
  }

  return matches[1]
    .split("\n")
    .map((line) => line.replace(/\s?\*/, "").trim())
    .join("\n")
    .trim();
}

export function parseModuleName(module) {
  return module.replace(path.extname(module), "");
}
