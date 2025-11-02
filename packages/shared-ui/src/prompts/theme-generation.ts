/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import { ThemePromptArgs } from "../state/types";

export { createThemeGenerationPrompt, getThemeFromIntentGenerationPrompt };

function getInstruction(context: string, userInstruction?: string): string {
  return `## Objective
  
  Create a sophisticated and impactful visual metaphor or representation for the given input, ensuring the image communicates professionalism, innovation, and clarity, suitable for a mobile web app splash screen. Generate a high-resolution, visually stunning splash screen that is beautiful, exceptionally well-designed, and sleek, intended to represent a specific concept. In some cases, depending on the prompt it may be appropriate to show a literal item as part of the image. Use your artistic and aesthetic judgment.

## Context

${context}

Art Medium: 
- Emphasize matte finishes and soft-touch materials. 
- Use crisp, high-fidelity details to suggest precision, not just sharp geometric edges.

Lighting: 
- Soft, diffused studio lighting, reminiscent of high-end product photography.
- Use gentle ambient occlusion and subtle gradients to define form, creating a clean, modern feel without harsh edge lights.

Composition & Framing:
 - Layout: Balanced and dynamic composition. Utilize the rule of thirds or a strong central focal point with some minimal abstract elements. The design should feel spacious and intentional.
- Depth: Create a sense of depth through subtle layering, volumetric lighting, and minimal use of foreground/background elements.
- Camera Angle: A slightly elevated, wide-angle shot or a clean, eye-level perspective to capture the full scope of the elegant design. Ensure the composition is impactful and clear.

Lighting & Color Palette:
- Lighting: Dramatic yet clean. Backlighting and edge lighting can enhance the sleekness.

Texture & Details:
- Detail Level: High level of detail in the image, ensuring crispness and clarity even in subtle elements. Every component should appear intentionally placed and meticulously crafted. Do not clutter the image with too many elements. 

Aspect Ratio: 1:1
- Constraint: The image must evoke a sense of intelligence and refined elegance. It should be visually engaging without being distracting, and immediately convey a sense of the topic's importance and modernity.

IMPORTANT: 
- If the user has provided stylistic instructions below you MUST incorporate those into the image! 
- Do not render text or titles on the splash image. It will be laid over separately and if you do, you'll create a weird double-text rendering.
- You must never under any circumstances a phone surround on the image
- No sci-fi, futuristic, glowing lines, neon, circuits, circuit board, cybernetic, biomechanical, chrome, shiny metal, hexagonal grid, HUD interface

${
  userInstruction
    ? `## User's stylistic instructions

${userInstruction}`
    : ""
}`;
}

function getThemeFromIntentGenerationPrompt(intent: string): LLMContent {
  const context = `The application will be designed based on this intent:

<intent>
${intent}
</intent>

Try to visualize how the splash screen for this application would look like.

`;
  const text = getInstruction(context);

  return { parts: [{ text }] };
}

function createThemeGenerationPrompt(args: ThemePromptArgs): LLMContent {
  const { random, title, description, userInstruction = "" } = args;
  let appName = title;
  let appDescription = description;
  if (random) {
    appName = "Random application";
    appDescription =
      "Generate me a fun image of your choosing about anything you like";
  }
  appDescription = appDescription
    ? `The app does the following: ${appDescription}`
    : "";

  const context = `The application's name is: "${appName}".

${appDescription}`;

  const text = getInstruction(context, userInstruction);

  return { parts: [{ text }] };
}
