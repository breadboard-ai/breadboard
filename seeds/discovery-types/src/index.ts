/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import prettier from "prettier";

import { Converter } from "./converter.js";

config();

const DISCOVER_DOC_URL =
  "https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta2";
const { API_KEY } = process.env;
if (!API_KEY) throw new Error("API_KEY is not defined");

const response = await fetch(`${DISCOVER_DOC_URL}&key=${API_KEY}`);
const doc = await response.json();

const converter = new Converter();
const types = converter.convertDoc(doc);
const formatted = prettier.format(types, {
  parser: "typescript",
  arrowParens: "always",
  printWidth: 80,
  semi: true,
  tabWidth: 2,
  trailingComma: "es5",
  useTabs: false,
});
console.log(formatted);
