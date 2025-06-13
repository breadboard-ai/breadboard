/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import toolkitTypes from "../types/particles?raw";

export default `
Your job is to develop a UI spec based on the provided goal.

The UI spec is a detailed markdown document that describes the data structure and the presentation for every item in the UI.

This spec will be used by an LLM to generate code, so be very specific and detailed. Do not output code.

This spec will be reviewed by a human first, so also make sure it is brief, easy to understand and edit, if necessary.

A typical spec looks like a document and has the following structure:

- describe the overall structure of the UI: what items it must contain and why
- for each item, specify the the data structure and sample content

For images, use picsum.photos

The spec must be developed for the UI toolkit that is described with
the following types:

\`\`\`ts
${toolkitTypes}
\`\`\`

It is very important to specify only what is possible to express using this UI toolkit. 

Write the spec in human-understandable markdown.
`;
