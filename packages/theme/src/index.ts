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

export function createThemeMapping(
  palettes: ColorPalettes
): Record<string, string> {
  const styles: Record<string, string> = {};
  for (const palette of Object.values(palettes)) {
    for (const [key, val] of Object.entries(palette)) {
      const prop = toProp(key, "light-dark-");
      const propTarget = toProp(key);
      styles[prop] = `light-dark(${val}, ${mapColor(propTarget)})`;
    }
  }

  return styles;
}

function toProp(key: string, prefix = "") {
  if (key.startsWith("nv")) {
    return `--${prefix}nv-${key.slice(2)}`;
  }

  return `--${prefix}${key[0]}-${key.slice(1)}`;
}

// TODO: Fill out a proper mapping.
const mapping = new Map([
  // Step colors.
  ["#c2d5fb", "oklch(from #c2d5fb calc(l * 0.4) c h)"],
  ["#e0eafe", "oklch(from #e0eafe calc(l * 0.4) c h)"],
  ["#c4fcd4", "oklch(from #c4fcd4 calc(l * 0.4) c h)"],
  ["#d9ffe4", "oklch(from #d9ffe4 calc(l * 0.4) c h)"],
  ["#effe96", "oklch(from #effe96 calc(l * 0.4) c h)"],
  ["#f2ffa3", "oklch(from #f2ffa3 calc(l * 0.4) c h)"],
  ["#f6c9ad", "oklch(from #f6c9ad calc(l * 0.4) c h)"],
  ["#fceee9", "oklch(from #fceee9 calc(l * 0.4) c h)"],

  // Secondary.
  ["--s-95", "--s-5"],
  ["--s-90", "--s-10"],

  // Primary.
  ["--p-40", "--p-60"],
  ["--p-25", "--p-80"],
  ["--p-15", "--p-90"],
]);

export function mapColor(col: string): string {
  const remappedColor = mapping.get(col);
  if (remappedColor) {
    return remappedColor.startsWith("--")
      ? `var(${remappedColor})`
      : remappedColor;
  }

  const wrappedCol = col.startsWith("--") ? `var(${col})` : col;
  return `rgb(from ${wrappedCol} calc(255 - r) calc(255 - g) calc(255 - b))`;
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
  palette: AppPalette | ColorPalettes
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
      styles[lightDarkKey] = `light-dark(${col}, ${mapColor(key)})`;
    }
  }

  return styles;
}
