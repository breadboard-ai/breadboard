/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  themeFromImage,
  TonalPalette,
  hexFromArgb,
  themeFromSourceColor,
  argbFromHex,
} from "@material/material-color-utilities";

import { type AppPalette } from "@breadboard-ai/types";

const paletteFactory = () => {
  return {
    primary: {},
    secondary: {},
    tertiary: {},
    neutral: {},
    neutralVariant: {},
    error: {},
  } satisfies AppPalette;
};

const toneVals = [
  100, 99, 98, 95, 90, 80, 70, 60, 50, 40, 35, 30, 25, 20, 15, 10, 5, 0,
];

export async function generatePaletteFromImage(
  image: HTMLImageElement
): Promise<AppPalette | null> {
  const generatedPalette: AppPalette = paletteFactory();
  try {
    const theme = await themeFromImage(image);
    const keys = Object.keys(theme.palettes) as Array<
      keyof typeof theme.palettes
    >;

    for (const k of keys) {
      const palette = TonalPalette.fromHueAndChroma(
        theme.palettes[k].hue,
        theme.palettes[k].chroma
      );

      for (const t of toneVals) {
        generatedPalette[k][t] = hexFromArgb(palette.tone(t));
      }
    }

    return generatedPalette;
  } catch (e) {
    console.error(
      "Unable to generate palette from image",
      (e as Error).message
    );
    return null;
  }
}

export function generatePaletteFromColor(color: string): AppPalette {
  const generatedPalette: AppPalette = paletteFactory();
  const theme = themeFromSourceColor(argbFromHex(color));
  const keys = Object.keys(theme.palettes) as Array<
    keyof typeof theme.palettes
  >;

  for (const k of keys) {
    const palette = TonalPalette.fromHueAndChroma(
      theme.palettes[k].hue,
      theme.palettes[k].chroma
    );

    for (const t of toneVals) {
      generatedPalette[k][t] = hexFromArgb(palette.tone(t));
    }
  }

  return generatedPalette;
}

function toStyleName(key: string, tone: number) {
  let styleKey = key.toLocaleLowerCase().charAt(0);
  if (key === "neutralVariant") {
    styleKey = "nv";
  }

  return `--${styleKey}-${tone}`;
}

const refPalette = paletteFactory();
export function createThemeStyles(palette: AppPalette): Record<string, string> {
  const styles: Record<string, string> = {};
  const keys = Object.keys(refPalette) as Array<keyof typeof palette>;

  for (const k of keys) {
    for (const t of toneVals) {
      const key = toStyleName(k, t);
      styles[key] = palette[k][t] ?? "#000000";
    }
  }

  return styles;
}
