/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, Outcome } from "@breadboard-ai/types";
import { ProjectThemeState } from "./types";
import { ThemePromptArgs } from "../sideboards/types";
import { AppTheme } from "../types/types";
import { err } from "@breadboard-ai/utils";
import {
  generatePaletteFromColor,
  generatePaletteFromImage,
} from "@breadboard-ai/theme";
import { isInlineData } from "@breadboard-ai/data";
import { createThemeGenerationPrompt } from "../prompts/theme-generation";

export { ThemeState };

const IMAGE_GENERATOR = "gemini-2.5-flash-image";

function endpointURL(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

class ThemeState implements ProjectThemeState {
  constructor(private readonly fetchWithCreds: typeof globalThis.fetch) {}

  async generateTheme(
    args: ThemePromptArgs,
    signal: AbortSignal
  ): Promise<Outcome<AppTheme>> {
    const body = {
      contents: createThemeGenerationPrompt(args),
    };

    const response = await this.fetchWithCreds(endpointURL(IMAGE_GENERATOR), {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
    const result = (await response.json()) as {
      candidates: {
        content: LLMContent;
      }[];
    };
    if (!response.ok) {
      console.warn(`Theme generation failed with this error`, result);
      return err(`Unable to generate theme`);
    }
    const content = result.candidates.at(0)?.content;
    if (!content) {
      return err(`No content returned`);
    }

    const [splashScreen] = content.parts.filter(
      (part) => "inlineData" in part || "storedData" in part
    );

    if (!splashScreen) {
      return err("Invalid model response");
    }

    try {
      let theme = generatePaletteFromColor("#330072");
      const img = new Image();
      if (isInlineData(splashScreen)) {
        img.src = `data:${splashScreen.inlineData.mimeType};base64,${splashScreen.inlineData.data}`;
      } else {
        img.src = splashScreen.storedData.handle;
        img.crossOrigin = "anonymous";
      }
      const generatedTheme = await generatePaletteFromImage(img);
      if (generatedTheme) {
        theme = generatedTheme;
      }

      return {
        ...theme,
        primaryColor: "",
        secondaryColor: "",
        textColor: "",
        tertiary: "",
        primaryTextColor: "",
        backgroundColor: "",
        splashScreen,
      };
    } catch (e) {
      console.warn(e);
      return err("Invalid color scheme generated");
    }
  }
}
