/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup, unsafeCSS } from "lit";
import { ColorPalettes } from "../../types/types";
import * as Theme from "../../../theme/index.js";

export const custom = {
  c100: "#665ef6",
};

export const uiColorMapping: Map<string, string> = new Map([
  // Neutral.
  ["--n-0", "--n-100"],
  ["--n-5", "--n-95"],
  ["--n-10", "--n-90"],
  ["--n-15", "--n-80"],
  ["--n-20", "--n-80"],
  ["--n-25", "--n-70"],
  ["--n-30", "--n-70"],
  ["--n-35", "--n-60"],
  ["--n-40", "--n-60"],
  ["--n-50", "--n-50"],
  ["--n-60", "--n-40"],
  ["--n-70", "--n-30"],
  ["--n-80", "--n-20"],
  ["--n-90", "--n-10"],
  ["--n-95", "--n-5"],
  ["--n-98", "--n-5"],
  ["--n-99", "--n-5"],
  ["--n-100", "--n-0"],

  // Primary.
  ["--p-0", "--p-100"],
  ["--p-5", "--p-95"],
  ["--p-10", "--p-90"],
  ["--p-15", "--p-80"],
  ["--p-20", "--p-80"],
  ["--p-25", "--p-70"],
  ["--p-30", "--p-70"],
  ["--p-35", "--p-60"],
  ["--p-40", "--p-60"],
  ["--p-50", "--p-50"],
  ["--p-60", "--p-40"],
  ["--p-70", "--p-30"],
  ["--p-80", "--p-20"],
  ["--p-90", "--p-10"],
  ["--p-95", "--p-5"],
  ["--p-98", "--p-5"],
  ["--p-99", "--p-5"],

  // Secondary.
  ["--s-100", "--s-0"],
  ["--s-0", "--s-100"],
  ["--s-5", "--s-95"],
  ["--s-10", "--s-90"],
  ["--s-15", "--s-80"],
  ["--s-20", "--s-80"],
  ["--s-25", "--s-70"],
  ["--s-30", "--s-70"],
  ["--s-35", "--s-60"],
  ["--s-40", "--s-60"],
  ["--s-50", "--s-50"],
  ["--s-60", "--s-40"],
  ["--s-70", "--s-30"],
  ["--s-80", "--s-20"],
  ["--s-90", "--s-10"],
  ["--s-95", "--s-5"],
  ["--s-98", "--s-5"],
  ["--s-99", "--s-5"],
  ["--s-100", "--s-0"],

  // Tertiary.
  ["--t-100", "--t-0"],
  ["--t-0", "--t-100"],
  ["--t-5", "--t-95"],
  ["--t-10", "--t-90"],
  ["--t-15", "--t-80"],
  ["--t-20", "--t-80"],
  ["--t-25", "--t-70"],
  ["--t-30", "--t-70"],
  ["--t-35", "--t-60"],
  ["--t-40", "--t-60"],
  ["--t-50", "--t-50"],
  ["--t-60", "--t-40"],
  ["--t-70", "--t-30"],
  ["--t-80", "--t-20"],
  ["--t-90", "--t-10"],
  ["--t-95", "--t-5"],
  ["--t-98", "--t-5"],
  ["--t-99", "--t-5"],
  ["--t-100", "--t-0"],

  // Neutral Variant.
  ["--nv-100", "--nv-0"],
  ["--nv-0", "--nv-100"],
  ["--nv-5", "--nv-95"],
  ["--nv-10", "--nv-90"],
  ["--nv-15", "--nv-80"],
  ["--nv-20", "--nv-80"],
  ["--nv-25", "--nv-70"],
  ["--nv-30", "--nv-70"],
  ["--nv-35", "--nv-60"],
  ["--nv-40", "--nv-60"],
  ["--nv-50", "--nv-50"],
  ["--nv-60", "--nv-40"],
  ["--nv-70", "--nv-30"],
  ["--nv-80", "--nv-20"],
  ["--nv-90", "--nv-10"],
  ["--nv-95", "--nv-5"],
  ["--nv-98", "--nv-5"],
  ["--nv-99", "--nv-5"],
  ["--nv-100", "--nv-0"],

  // Error.
  ["--e-100", "--e-0"],
  ["--e-0", "--e-100"],
  ["--e-5", "--e-95"],
  ["--e-10", "--e-90"],
  ["--e-15", "--e-80"],
  ["--e-20", "--e-80"],
  ["--e-25", "--e-70"],
  ["--e-30", "--e-70"],
  ["--e-35", "--e-60"],
  ["--e-40", "--e-60"],
  ["--e-50", "--e-50"],
  ["--e-60", "--e-40"],
  ["--e-70", "--e-30"],
  ["--e-80", "--e-20"],
  ["--e-90", "--e-10"],
  ["--e-95", "--e-5"],
  ["--e-98", "--e-5"],
  ["--e-99", "--e-5"],
  ["--e-100", "--e-0"],
]);

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
    p99: "color-mix(in srgb, #665ef6 2%, white 98%)",
    p98: "color-mix(in srgb, #665ef6 4%, white 96%)",
    p95: "color-mix(in srgb, #665ef6 10%, white 90%)",
    p90: "color-mix(in srgb, #665ef6 20%, white 80%)",
    p80: "color-mix(in srgb, #665ef6 40%, white 60%)",
    p70: "color-mix(in srgb, #665ef6 60%, white 40%)",
    p60: "color-mix(in srgb, #665ef6 80%, white 20%)",
    p50: "#665ef6",
    p40: "color-mix(in srgb, #665ef6 80%, black 20%)",
    p35: "color-mix(in srgb, #665ef6 70%, black 30%)",
    p30: "color-mix(in srgb, #665ef6 60%, black 40%)",
    p25: "color-mix(in srgb, #665ef6 50%, black 50%)",
    p20: "color-mix(in srgb, #665ef6 40%, black 60%)",
    p15: "color-mix(in srgb, #665ef6 20%, black 80%)",
    p10: "color-mix(in srgb, #665ef6 10%, black 90%)",
    p5: "color-mix(in srgb, #665ef6 5%, black 95%)",
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

export const stepsLight = {
  generate: "#c2d5fb",
  generateSecondary: "#e0eafe",
  display: "#c4fcd4",
  displaySecondary: "#d9ffe4",
  getInput: "#effe96",
  getInputSecondary: "#f2ffa3",
  asset: "#f6c9ad",
  assetSecondary: "#fceee9",
};

export const stepsDark = {
  generate: "#c2d5fb",
  generateSecondary: "#e0eafe",
  display: "#c4fcd4",
  displaySecondary: "#d9ffe4",
  getInput: "#effe96",
  getInputSecondary: "#f2ffa3",
  asset: "#f6c9ad",
  assetSecondary: "#fceee9",
};

export const baseColors = css`
  :host {
    ${unsafeCSS(
      Object.entries(Theme.createThemeStyles(palette, uiColorMapping))
        .map(([key, value]) => {
          return `${key}: ${value};`;
        })
        .join("\n")
    )}
  }

  :host {
    ${unsafeCSS(
      Object.entries(
        Theme.createThemeStyles(palette, uiColorMapping, "original-")
      )
        .map(([key, value]) => {
          return `${key}: ${value};`;
        })
        .join("\n")
    )}
  }

  :host {
    --ui-generate: light-dark(
      ${unsafeCSS(stepsLight.generate)},
      ${unsafeCSS(stepsDark.generate)}
    );
    --ui-generate-secondary: light-dark(
      ${unsafeCSS(stepsLight.generateSecondary)},
      ${unsafeCSS(stepsDark.generateSecondary)}
    );
    --ui-display: light-dark(
      ${unsafeCSS(stepsLight.display)},
      ${unsafeCSS(stepsDark.display)}
    );
    --ui-display-secondary: light-dark(
      ${unsafeCSS(stepsLight.displaySecondary)},
      ${unsafeCSS(stepsDark.displaySecondary)}
    );
    --ui-get-input: light-dark(
      ${unsafeCSS(stepsLight.getInput)},
      ${unsafeCSS(stepsDark.getInput)}
    );
    --ui-get-input-secondary: light-dark(
      ${unsafeCSS(stepsLight.getInputSecondary)},
      ${unsafeCSS(stepsDark.getInputSecondary)}
    );
    --ui-asset: light-dark(
      ${unsafeCSS(stepsLight.asset)},
      ${unsafeCSS(stepsDark.asset)}
    );
    --ui-asset-secondary: light-dark(
      ${unsafeCSS(stepsLight.assetSecondary)},
      ${unsafeCSS(stepsDark.assetSecondary)}
    );
  }

  :host {
    --ui-custom-o-100: ${unsafeCSS(custom.c100)};

    ${unsafeCSS(
      new Array(19)
        .fill(0)
        .map((_, idx) => {
          const alpha = (idx + 1) * 0.05;
          const opacity = (idx + 1) * 5;

          return `--ui-custom-o-${opacity}: oklch(
            from var(--ui-custom-o-100) l c h / calc(alpha * ${alpha})
          );`;
        })
        .join("\n")
    )}

    --ui-scrim: light-dark(rgba(255, 255, 255, 0.6), rgba(0, 0, 0, 0.6));
    --ui-flowgen-step: light-dark(#e2e1f1, var(--n-20));
    --ui-theme-segment: light-dark(#f1f4f8, var(--n-10));
    --ui-theme-generating: light-dark(#d6e2fb, var(--n-50));

    --ui-warning-border-color: light-dark(#b2affb, var(--n-20));
    --ui-warning-background-color: light-dark(#d8d7fe, var(--n-20));
    --ui-warning-text-color: light-dark(#33324f, var(--n-70));
  }
` as CSSResultGroup;
