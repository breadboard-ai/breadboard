/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { agents } from "@google-labs/agent-kit";
import { board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const dummyAgent = code(() => {
  const voteRequestContent = {
    adCampaign: {
      headlines: [
        "Breadboard: AI Playground",
        "Exp. AI Patterns",
        "Rapid Prototyping",
        "AI Power, Gemini",
        "Integrate AI Seamlessly",
        "Create Graphs, Prompts",
        "Accessible AI",
        "Breadboard: Dev's AI Kit",
        "Supercharge Dev, Breadboard",
        "Accelerate Innovation",
        "Revolutionize Dev, AI",
        "Breadboard: AI, Ingenuity",
        "Elevate Projects, Breadboard",
        "Unlock AI Power, Breadboard",
      ],
      descriptions: [
        "Breadboard: Play, experiment, prototype with AI. Integrate AI with Gemini.",
        "Stunning graphs with prompts. Accessible AI for devs.",
        "Accelerate innovation with Breadboard. Experiment with AI risk-free.",
        "Elevate projects with Breadboard AI. Integrate AI seamlessly.",
      ],
    },
    voteRequest: "Does this ad campaign seem ok to you?",
  };

  return {
    context: [
      {
        parts: [
          {
            text: JSON.stringify(voteRequestContent),
          },
        ],
        role: "model",
      },
    ],
  };
});

export default await board(() => {
  const start = core.passthrough({
    $metadata: { title: "Start" },
    context: [],
  });

  const writer = dummyAgent({
    $metadata: { title: "Ad Writer " },
    context: start.context,
  });
  const humanVoter = agents.human({
    $metadata: { title: "Human Voter" },
    context: writer.context,
  });

  humanVoter.rejected.as("context").to(writer);

  return { text: humanVoter.context };
}).serialize({
  title: "Human Feedback Test Bench",
  description:
    "A test for various forms of human feedback, using the `Human` node from the Agent Kit",
  version: "0.0.1",
});
