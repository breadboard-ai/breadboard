/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import OpenAPI from "./boards/openapi.js";
import { Board, asRuntimeKit } from "@google-labs/breadboard";
import yaml from "yaml";
import core from "@google-labs/core-kit";
import starter from "@google-labs/llm-starter";
import { readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

export const importGraph = async (
  url: string,
  options: Record<string, string>
) => {
  if (URL.canParse(url) == false) {
    const fileStat = await stat(path.resolve(process.cwd(), url));
    if (fileStat != undefined && fileStat.isFile()) {
      // We think it's a file.
      url = pathToFileURL(url).toString();
    } else {
      throw new Error("Invalid URL");
    }
  }

  const apiPath = options.api;
  const outputPath = options.output;

  if (apiPath == undefined && outputPath == undefined) {
    console.error(
      "You must specify either -a (an API) or a directory to output all of the APIs to."
    );
    return;
  }

  let openAPIData = "";
  let json;

  try {
    if (url.startsWith("file://")) {
      openAPIData = await readFile(url.replace("file://", ""), {
        encoding: "utf-8",
      });
    } else {
      openAPIData = await (await fetch(url)).text();
    }
  } catch (e) {
    throw new Error(`Unable to fetch OpenAPI spec from ${url}`);
  }

  try {
    json = yaml.parse(openAPIData);
  } catch (yamlLoadError) {
    try {
      json = JSON.parse(openAPIData);
    } catch (jsonLoadError) {
      throw new Error(
        `Unable to parse OpenAPI spec from ${url}. It's not a valid JSON or YAML file.`
      );
    }
  }

  const openAPIBoard = await Board.fromGraphDescriptor(OpenAPI);

  const boards = await openAPIBoard.runOnce(
    { json },
    { kits: [asRuntimeKit(core), asRuntimeKit(starter)] }
  );

  if (boards == undefined || boards == null) {
    throw new Error("Unable to generate list of boards from an API spec.");
  }

  for (const api of Object.keys(boards)) {
    if (apiPath == api || apiPath == undefined) {
      const apiRef = boards[api] as { kind: string; board: Board };
      if (apiRef == undefined) {
        continue;
      }

      const board = apiRef;
      if (outputPath != undefined) {
        outputBoard(board.board, api, outputPath);
      } else {
        console.log(JSON.stringify(board.board, null, 2));
      }
    }
  }
};

const outputBoard = async (
  board: unknown,
  apiPath: string,
  outputPath: string
) => {
  const boardJSON = JSON.stringify(board);
  const boardName = apiPath;
  const boardPath = path.join(
    path.resolve(process.cwd(), outputPath),
    `${boardName}.json`
  );
  writeFile(boardPath, boardJSON, { encoding: "utf-8" });
};
