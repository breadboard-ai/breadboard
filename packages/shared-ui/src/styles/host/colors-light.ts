/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup, unsafeCSS } from "lit";
import { ColorPalettes } from "../../types/types";

export const custom = {
  c100: "#665ef6",
};

export const palette: ColorPalettes = {
  neutral: {
    n100: "#ffffff",
    n99: "#fcfcfc",
    n98: "#f9f9f9",
    n95: "#f1f1f1",
    n90: "#e2e2e2",
    n80: "#c6c6c6",
    n70: "#ababab",
    n60: "#919191",
    n50: "#777777",
    n40: "#5e5e5e",
    n35: "#525252",
    n30: "#474747",
    n25: "#3b3b3b",
    n20: "#303030",
    n15: "#262626",
    n10: "#1b1b1b",
    n5: "#111111",
    n0: "#000000",
  },

  primary: {
    p100: "#ffffff",
    p99: "#fcfcfc",
    p98: "#f9f9f9",
    p95: "#f1f1f1",
    p90: "#e2e2e2",
    p80: "#c6c6c6",
    p70: "#ababab",
    p60: "#919191",
    p50: "#777777",
    p40: "#5e5e5e",
    p35: "#525252",
    p30: "#474747",
    p25: "#3b3b3b",
    p20: "#303030",
    p15: "#262626",
    p10: "#1b1b1b",
    p5: "#111111",
    p0: "#000000",
  },

  secondary: {
    s100: "#ffffff",
    s99: "#fcfcfc",
    s98: "#f9f9f9",
    s95: "#f1f1f1",
    s90: "#e2e2e2",
    s80: "#c6c6c6",
    s70: "#ababab",
    s60: "#919191",
    s50: "#777777",
    s40: "#5e5e5e",
    s35: "#525252",
    s30: "#474747",
    s25: "#3b3b3b",
    s20: "#303030",
    s15: "#262626",
    s10: "#1b1b1b",
    s5: "#111111",
    s0: "#000000",
  },

  tertiary: {
    t100: "#ffffff",
    t99: "#fffbff",
    t98: "#fff8f9",
    t95: "#ffecf4",
    t90: "#ffd8ec",
    t80: "#e9b9d3",
    t70: "#cc9eb8",
    t60: "#af849d",
    t50: "#946b83",
    t40: "#79536a",
    t35: "#6c475d",
    t30: "#5f3c51",
    t25: "#523146",
    t20: "#46263a",
    t15: "#3a1b2f",
    t10: "#2e1125",
    t5: "#22071a",
    t0: "#000000",
  },

  neutralVariant: {
    nv100: "#ffffff",
    nv99: "#fffbff",
    nv98: "#fcf8ff",
    nv95: "#f2effa",
    nv90: "#e4e1ec",
    nv80: "#c8c5d0",
    nv70: "#acaab4",
    nv60: "#918f9a",
    nv50: "#777680",
    nv40: "#5e5d67",
    nv35: "#52515b",
    nv30: "#46464f",
    nv25: "#3b3b43",
    nv20: "#303038",
    nv15: "#25252d",
    nv10: "#1b1b23",
    nv5: "#101018",
    nv0: "#000000",
  },

  error: {
    e100: "#ffffff",
    e99: "#fffbff",
    e98: "#fff8f7",
    e95: "#ffedea",
    e90: "#ffdad6",
    e80: "#ffb4ab",
    e70: "#ff897d",
    e60: "#ff5449",
    e50: "#de3730",
    e40: "#ba1a1a",
    e35: "#a80710",
    e30: "#93000a",
    e25: "#7e0007",
    e20: "#690005",
    e15: "#540003",
    e10: "#410002",
    e5: "#2d0001",
    e0: "#000000",
  },
} as ColorPalettes;

export const steps = {
  generate: "#c2d5fb",
  generateSecondary: "#e0eafe",
  display: "#c4fcd4",
  displaySecondary: "#d9ffe4",
  getInput: "#effe96",
  getInputSecondary: "#f2ffa3",
  asset: "#f6c9ad",
  assetSecondary: "#fceee9",
};

function createThemeStyles(palettes: ColorPalettes): Record<string, string> {
  const styles: Record<string, string> = {};
  for (const palette of Object.values(palettes)) {
    for (const [key, val] of Object.entries(palette)) {
      const prop = toProp(key);
      styles[prop] = val;
    }
  }

  return styles;
}

function toProp(key: string) {
  if (key.startsWith("nv")) {
    return `--nv-${key.slice(2)}`;
  }

  return `--${key[0]}-${key.slice(1)}`;
}

export const colorsLight = css`
  :host {
    --ui-custom-o-100: ${unsafeCSS(custom.c100)};
    --ui-custom-o-25: oklch(
      from var(--ui-custom-o-100) l c h / calc(alpha * 0.25)
    );
    --ui-custom-o-20: oklch(
      from var(--ui-custom-o-100) l c h / calc(alpha * 0.2)
    );
    --ui-custom-o-10: oklch(
      from var(--ui-custom-o-100) l c h / calc(alpha * 0.1)
    );
    --ui-custom-o-5: oklch(
      from var(--ui-custom-o-100) l c h / calc(alpha * 0.05)
    );
    --ui-scrim: rgba(0, 0, 0, 0.6);
    --ui-flowgen-step: #e2e1f1;
    --ui-theme-segment: #f1f4f8;
    --ui-theme-generating: #d6e2fb;
  }

  :host {
    --ui-generate: ${unsafeCSS(steps.generate)};
    --ui-generate-secondary: ${unsafeCSS(steps.generateSecondary)};
    --ui-display: ${unsafeCSS(steps.display)};
    --ui-display-secondary: ${unsafeCSS(steps.displaySecondary)};
    --ui-get-input: ${unsafeCSS(steps.getInput)};
    --ui-get-input-secondary: ${unsafeCSS(steps.getInputSecondary)};
    --ui-asset: ${unsafeCSS(steps.asset)};
    --ui-asset-secondary: ${unsafeCSS(steps.assetSecondary)};
  }

  :host {
    ${unsafeCSS(
      Object.entries(createThemeStyles(palette))
        .map(([key, value]) => {
          return `${key}: ${value};`;
        })
        .join("\n")
    )}
  }
` as CSSResultGroup;
