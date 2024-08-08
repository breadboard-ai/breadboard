/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { annotate, board, input } from "@breadboard-ai/build";

const persona = input({
  title: "Persona",
  description:
    "Describe the worker's skills, capabilities, mindset, and thinking process",
  type: annotate("string", { behavior: ["config"] }),
});

export default board({
  id: "specialist-new",
  metadata: {
    icon: "smart-toy",
    description:
      "Given instructions on how to act, performs a single task, optionally invoking tools.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/agents/#specialist",
    },
  },
  inputs: { persona },
  outputs: {
    persona,
  },
});
