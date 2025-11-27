/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup, unsafeCSS } from "lit";
import { ColorPalettes } from "../../types/types";
import * as Theme from "@breadboard-ai/theme";

export const palette: ColorPalettes = {
  neutral: {
    n100: "#ffffff",
    n99: "#FDFCFB",
    n98: "#f5f5f5",
    n95: "#F2F2F2",
    n90: "#E3E3E3",
    n80: "#C7C7C7",
    n70: "#ABABAB",
    n60: "#8F8F8F",
    n50: "#757575",
    n40: "#5E5E5E",
    n35: "#525252",
    n30: "#474747",
    n25: "#3f3f3f",
    n20: "#303030",
    n15: "#252525",
    n10: "#1F1F1F",
    n0: "#000000",
  },

  primary: {
    p100: "#ffffff",
    p99: "#FAFBFF",
    p98: "#f7faff",
    p95: "#ECF3FE",
    p90: "#D3E3FD",
    p80: "#A8C7FA",
    p70: "#7CACF8",
    p60: "#4C8DF6",
    p50: "#1B6EF3",
    p40: "#0B57D0",
    p30: "#0842A0",
    p20: "#062E6F",
    p10: "#041E49",
    p0: "#000000",
  },

  secondary: {
    s100: "#ffffff",
    s99: "#F7FCFF",
    s95: "#DFF3FF",
    s90: "#C2E7FF",
    s80: "#7FCFFF",
    s70: "#5AB3F0",
    s60: "#3998D3",
    s50: "#047DB7",
    s40: "#00639B",
    s30: "#004A77",
    s20: "#003355",
    s10: "#001D35",
    s0: "#000000",
  },

  tertiary: {
    t100: "#ffffff",
    t99: "#F2FFEE",
    t95: "#E7F8ED",
    t90: "#C4EED0",
    t80: "#6DD58C",
    t70: "#37BE5F",
    t60: "#1EA446",
    t50: "#198639",
    t40: "#146C2E",
    t30: "#0F5223",
    t20: "#0A3818",
    t10: "#072711",
    t0: "#000000",
  },

  neutralVariant: {
    nv100: "#ffffff",
    nv99: "#fafdfb",
    nv98: "#f9f9f9",
    nv95: "#eff2ef",
    nv90: "#e1e3e1",
    nv80: "#C4C7C5",
    nv70: "#A9ACAA",
    nv60: "#8E918F",
    nv50: "#747775",
    nv40: "#5C5F5E",
    nv35: "#555353",
    nv30: "#444746",
    nv25: "#312e2e",
    nv20: "#2D312F",
    nv15: "#262525",
    nv10: "#191D1C",
    nv5: "#111111",
    nv0: "#000000",
  },

  error: {
    e100: "#ffffff",
    e99: "#FFFBF9",
    e95: "#FCEEEE",
    e90: "#F9DEDC",
    e80: "#F2B8B5",
    e70: "#EC928E",
    e60: "#E46962",
    e50: "#DC362E",
    e40: "#B3261E",
    e30: "#8C1D18",
    e20: "#601410",
    e10: "#410E0B",
    e0: "#000000",
  },
} as ColorPalettes;

export const baseColors = css`
  :host {
    ${unsafeCSS(
      Object.entries(Theme.createThemeStyles(palette))
        .map(([key, value]) => {
          return `${key}: ${value};`;
        })
        .join("\n")
    )}

    --sys-color--primary: light-dark(var(--p-40), var(--p-80));
    --sys-color--on-primary: light-dark(var(--p-100), var(--p-20));
    --sys-color--primary-container: light-dark(var(--p-90), #1f3760);
    --sys-color--on-primary-container: light-dark(var(--p-30), var(--p-90));

    --sys-color--secondary: light-dark(var(--s-40), var(--s-80));
    --sys-color--on-secondary: light-dark(var(--s-100), var(--s-20));
    --sys-color--secondary-container: light-dark(var(--s-90), var(--s-30));
    --sys-color--on-secondary-container: light-dark(var(--s-30), var(--s-90));

    --sys-color--tertiary: light-dark(var(--t-40), var(--t-80));
    --sys-color--on-tertiary: light-dark(var(--t-100), var(--t-20));
    --sys-color--tertiary-container: light-dark(var(--t-90), var(--t-30));
    --sys-color--on-tertiary-container: light-dark(var(--t-30), var(--t-90));

    --sys-color--error: light-dark(var(--e-40), var(--e-80));
    --sys-color--on-error: light-dark(var(--e-100), var(--e-20));
    --sys-color--error-container: light-dark(var(--e-90), var(--e-20));
    --sys-color--on-error-container: light-dark(var(--e-30), var(--e-90));

    --sys-color--surface: light-dark(var(--n-100), #131314);
    --sys-color--surface-bright: light-dark(var(--n-100), #1e1f20);
    --sys-color--surface-dim: light-dark(#d3dbe5, #131314);
    --sys-color--surface-variant: light-dark(#e1e3e1, #444746);
    --sys-color--on-surface: light-dark(#1b1c1d, var(--n-90));
    --sys-color--on-surface-variant: light-dark(var(--nv-30), var(--nv-80));
    --sys-color--on-surface-low: light-dark(#727676, #9a9b9c);
    --sys-color--surface-container-lowest: light-dark(var(--nv-100), #0e0e0e);
    --sys-color--surface-container-low: light-dark(#f8fafd, #1b1b1b);
    --sys-color--surface-container: light-dark(#f0f4f9, #1e1f20);
    --sys-color--surface-container-high: light-dark(#e9eef6, #282a2c);
    --sys-color--surface-container-highest: light-dark(#dde3ea, #333537);
    --sys-color--inverse-surface: light-dark(var(--n-20), var(--n-90));
    --sys-color--inverse-on-surface: light-dark(var(--n-95), var(--n-20));
    --sys-color--inverse-primary: light-dark(var(--p-80), var(--p-40));
    --sys-color--scrim: var(--n-0);
    --sys-color--shadow: var(--n-0);

    --sys-color--outline: light-dark(var(--nv-50), var(--nv-60));
    --sys-color--outline-variant: light-dark(var(--nv-80), var(--nv-30));
    --sys-color--outline-low: light-dark(var(--nv-90), var(--nv-30));

    --sys-color--body-background: light-dark(var(--n-100), #131314);
  }
` as CSSResultGroup;
