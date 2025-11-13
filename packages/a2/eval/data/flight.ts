/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart, LLMContent } from "@breadboard-ai/types";

const parts: DataPart[] = [
  {
    text: `A single large Card representing the form.

Inside the Card is a Column with four Rows containing the form and, at the
bottom, a Button with a label (Search) and an icon (send).

## Form information
Row 1: MultipleChoice for "One Way / Round Trip" (weight: 1).
Row 2: A Row containing two TextField components (From/To) separated
by an Icon (flight).
Row 3: A Row containing two DateTimeInput fields (Depart/Return) and a
Slider (for "Max Price (USD)", min=100, max=10000).
Row 4: A Button (Search) aligned to the right with an icon (send).

## Other instructions
Include labels for form fields like TextField and DateTimeInput
    `,
  },
];

export const objective: LLMContent = { role: "user", parts };
