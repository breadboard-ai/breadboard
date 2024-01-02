/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import openapi from "./boards/openapi.js";
import { Board, asRuntimeKit } from "@google-labs/breadboard";
import yaml from "js-yaml";
import core from "@google-labs/core-kit";
import starter from "@google-labs/llm-starter";

export const importGraph = async (
  url: string,
  options: Record<string, string>
) => {
  if (URL.canParse(url) == false) throw new Error("Invalid URL");

  let openAPIData = "";
  let json;

  try {
    openAPIData = await (await fetch(url)).text();
  } catch (e) {
    throw new Error(`Unable to fetch OpenAPI spec from ${url}`);
  }

  try {
    json = yaml.load(openAPIData);
  } catch (yamlLoadError) {
    try {
      json = JSON.parse(openAPIData);
    } catch (jsonLoadError) {
      throw new Error(
        `Unable to parse OpenAPI spec from ${url}. It's not a valid JSON or YAML file.`
      );
    }
  }

  const openAPIBoard = await Board.fromGraphDescriptor(openapi);

  const board = await openAPIBoard.runOnce(
    { json },
    { kits: [asRuntimeKit(core), asRuntimeKit(starter)] }
  );

  if (board == undefined || board == null) {
    throw new Error("Unable to run board.");
  }

  console.log(JSON.stringify(board));
};
