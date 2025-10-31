/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import { ThemePromptArgs } from "../sideboards/types";

export { createThemeGenerationPrompt };

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

  const text = `
## Objective

You are creating an app splash screen for a mobile web app. You should use the context to understand what the web is called as well as any other requirements for the splash screen.

# Context

ULTRA IMPORTANT: The application's name is: "${appName}".

${appDescription}

${userInstruction ? `Additional instructions: ${userInstruction}` : ""}

## Style

You should create something unique and interesting, avoiding cliches and obvious motifs. You should use relatively few colors. The background must be a solid color without any adornments. You should also use the context to understand if there are additional instructions for what the style and contents should be. Under no circumstances should you ever deviate from the colors provided or use text in the splash screen (do NOT include the HEX color code in the background)

## Format

The image absolutely must be a portrait image in a 9:16 ratio, suitable for use on a mobile device's application launch screen. The contents of the image should be centered, leaving plenty of room around it for any background color. The image may be shown truncated to only the middle third of its height (with the top and bottom cut-off) so do your best to vertically center, and design the image to look good under a variety of responsive views. The image must be very high resolution and clear.
`;

  return { parts: [{ text }] };
}
