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

export { appColorMapping } from "./app-color-mappings.js";

type ColorShade =
  | 0
  | 5
  | 10
  | 15
  | 20
  | 25
  | 30
  | 35
  | 40
  | 50
  | 60
  | 70
  | 80
  | 90
  | 95
  | 98
  | 99
  | 100;

export type PaletteKeyVals = "n" | "nv" | "p" | "s" | "t" | "e";
export const shades: ColorShade[] = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100,
];

type CreatePalette<Prefix extends PaletteKeyVals> = {
  [Key in `${Prefix}${ColorShade}`]: string;
};

export type PaletteKey<Prefix extends PaletteKeyVals> = Array<
  keyof CreatePalette<Prefix>
>;

export type PaletteKeys = {
  neutral: PaletteKey<"n">;
  neutralVariant: PaletteKey<"nv">;
  primary: PaletteKey<"p">;
  secondary: PaletteKey<"s">;
  tertiary: PaletteKey<"t">;
  error: PaletteKey<"e">;
};

export type ColorPalettes = {
  neutral: CreatePalette<"n">;
  neutralVariant: CreatePalette<"nv">;
  primary: CreatePalette<"p">;
  secondary: CreatePalette<"s">;
  tertiary: CreatePalette<"t">;
  error: CreatePalette<"e">;
};

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

function toStyleName(key: string, tone: number, prefix = "") {
  let styleKey = key.toLocaleLowerCase().charAt(0);
  if (key === "neutralVariant") {
    styleKey = "nv";
  }

  return `--${prefix}${styleKey}-${tone}`;
}

function isColorPalette(
  p: Record<string, Record<string | number, unknown>>
): p is ColorPalettes {
  return (
    "primary" in p &&
    Object.keys(p["primary"]).every((p) =>
      Number.isNaN(Number.parseInt(p.charAt(0)))
    )
  );
}

function convertColorPaletteToAppPalette(p: ColorPalettes): AppPalette {
  const newPalette: AppPalette = structuredClone(refPalette);
  const keys = Object.keys(refPalette) as Array<keyof AppPalette>;

  for (const k of keys) {
    for (const t of toneVals) {
      const innerKey = k === "neutralVariant" ? "nv" : k.charAt(0);
      // console.log(p, k, `${innerKey}${t}`);
      // @ts-expect-error Key check.
      newPalette[k][t] = p[k][`${innerKey}${t}`];
    }
  }

  return newPalette;
}

const refPalette = paletteFactory();
export function createThemeStyles(
  palette: AppPalette | ColorPalettes,
  mapping?: Map<string, string>
): Record<string, string> {
  if (isColorPalette(palette)) {
    palette = convertColorPaletteToAppPalette(palette);
  }

  const styles: Record<string, string> = {};
  const keys = Object.keys(refPalette) as Array<keyof typeof palette>;

  for (const k of keys) {
    for (const t of toneVals) {
      const key = toStyleName(k, t);
      const lightDarkKey = toStyleName(k, t, "light-dark-");
      const col = palette[k][t] ?? "#000000";
      styles[key] = col;
      styles[lightDarkKey] =
        `light-dark(var(${key}), var(${mapping?.get(key) ?? key}))`;
    }
  }

  return styles;
}
