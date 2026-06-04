/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Utility for calling generate_webpage tool.
 */

import { GraphDescriptor, LLMContent, Outcome } from "@breadboard-ai/types";
import { executeWebpageStream } from "./generate-webpage-stream.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { type ProgressReporter } from "../agent/progress-work-item.js";
export { callGenWebpage, generateWebpage };

type ThemeColors = {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  primaryTextColor?: string;
};

type Color = {
  25?: string;
  50?: string;
  80?: string;
  90?: string;
  95?: string;
  98?: string;
};

type PaletteColors = {
  error?: Color;
  neutral?: Color;
  neutralVariant?: Color;
  primary?: Color;
  secondary?: Color;
  tertiary?: Color;
};

function defaultThemeColors(): ThemeColors {
  return {
    primaryColor: "#246db5",
    secondaryColor: "#5cadff",
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    primaryTextColor: "#ffffff",
  };
}

function getThemeColors(graph: GraphDescriptor | undefined): ThemeColors {
  if (!graph) return defaultThemeColors();
  const currentThemeId = graph.metadata?.visual?.presentation?.theme;
  if (!currentThemeId) return defaultThemeColors();
  const themeColors =
    graph.metadata?.visual?.presentation?.themes?.[currentThemeId]?.themeColors;
  if (!themeColors) return defaultThemeColors();
  return { ...defaultThemeColors(), ...themeColors };
}

function getPaletteColors(
  graph: GraphDescriptor | undefined
): PaletteColors | undefined {
  if (!graph) return;
  const currentThemeId = graph.metadata?.visual?.presentation?.theme;
  if (!currentThemeId) return;
  const palette =
    graph.metadata?.visual?.presentation?.themes?.[currentThemeId]?.palette;
  if (!palette) return {};
  return { ...palette };
}

function themeColorsPrompt(colors: ThemeColors): string {
  return `Unless otherwise specified, use the following theme colors:

- primary color: ${colors.primaryColor}
- secondary color: ${colors.secondaryColor}
- background color: ${colors.backgroundColor}
- text color: ${colors.textColor}
- primary text color: ${colors.primaryTextColor}

`;
}

function getPalettePrompt(colors: PaletteColors): string {
  return `Unless otherwise specified, use the following theme colors:
  
  - primary color, dark: ${colors.primary?.[25]}
  - primary color, light: ${colors.primary?.[98]}
  - secondary color, dark: ${colors.secondary?.[25]}
  - secondary color, light: ${colors.secondary?.[95]}
  - tertiary color, dark: ${colors.tertiary?.[25]}
  - tertiary color, light: ${colors.tertiary?.[80]}
  - background color: ${colors.secondary?.[90]}
  - error color: ${colors.error?.[50]}
  - neutral, dark: ${colors.neutral?.[25]}
  - neutral, light: ${colors.neutral?.[98]}
  `;
}

/**
 * High-level wrapper that extracts graph visual styles (theme/palette)
 * and appends them to the system text before calling generate_webpage.
 */
async function generateWebpage(
  moduleArgs: A2ModuleArgs,
  systemText: string,
  content: LLMContent[],
  reporter?: ProgressReporter | null
): Promise<Outcome<LLMContent>> {
  const graph = moduleArgs.context.currentGraph;
  const palette = getPaletteColors(graph);
  if (palette?.primary) {
    systemText += getPalettePrompt(palette);
  } else {
    const themeColors = getThemeColors(graph);
    systemText += themeColorsPrompt(themeColors);
  }
  return callGenWebpage(moduleArgs, systemText, content, "HTML", reporter);
}

/**
 * Main entry point for generating webpage HTML via streaming API.
 */
async function callGenWebpage(
  moduleArgs: A2ModuleArgs,
  instruction: string,
  content: LLMContent[],
  _renderMode: string,
  reporter?: ProgressReporter | null
): Promise<Outcome<LLMContent>> {
  return executeWebpageStream(moduleArgs, instruction, content, reporter);
}
