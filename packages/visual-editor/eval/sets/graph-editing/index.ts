/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { graphEditingSession } from "../../graph-editing-eval.js";

graphEditingSession({ name: "Graph Editing", uploadToDrive: true }, async (session) => {
  session.eval("make an image-generator app", async ({ invokeAgent }) => {
    const outcome = await invokeAgent(
      "Make me an app that asks the user for a topic, generates a funny picture about that topic, and shows it back to the user."
    );
    return outcome;
  });

  session.eval("make a math-quiz app", async ({ invokeAgent }) => {
    const outcome = await invokeAgent(
      "Make me an app that generates three random multiplication problems, asks the user for the answers, and grades them."
    );
    return outcome;
  });
});
