/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../../src/a2/a2/utils.js";

export const title = "Alien name generator";

export const objective = llm`
Your job is to generate alien names using Constructed Language (Conlang) Phonetics. 
  
Build a phonetic template engine with multiple sound palettes.

Then let the code pick one palette randomly

Then, generate 10 random names with this template using \`attrs\` for structure and \`numpy\` for probability. Makes sure to enclose the palette used along with the names.

Output as list of names with palette as a heading.
`.asContent();
