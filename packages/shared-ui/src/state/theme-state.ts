/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";
import { ProjectThemeState } from "./types";
import { SideBoardRuntime, ThemePromptArgs } from "../sideboards/types";
import { AppTheme } from "../types/types";
import { ok, err } from "@breadboard-ai/utils";
import {
  generatePaletteFromColor,
  generatePaletteFromImage,
} from "@breadboard-ai/theme";
import { isInlineData } from "@breadboard-ai/data";

export { ThemeState };

class ThemeState implements ProjectThemeState {
  constructor(private readonly sideBoardRuntime: SideBoardRuntime) {}

  async generateTheme(
    args: ThemePromptArgs,
    signal: AbortSignal
  ): Promise<Outcome<AppTheme>> {
    if (!this.sideBoardRuntime) {
      return err("Internal error: No side board runtime was available.");
    }
    const result = await this.sideBoardRuntime.createTheme(args, signal);
    if (!ok(result)) return result;

    const [splashScreen] = result.parts.filter(
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
