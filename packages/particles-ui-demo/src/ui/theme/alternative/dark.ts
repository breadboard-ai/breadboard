/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ColorPalettes } from "../../../types/colors";
import { createThemeStyles } from "../../styles/utils";
import { UITheme } from "../theme";

export const input = {
  "typography-f-sf": true,
  "typography-fs-i": true,
  "typography-w-400": true,
  "layout-p-3": true,
  "border-br-1": true,
  "border-bw-2": true,
  "color-bc-nv80": true,
  "color-bgc-s90": true,
  "border-bs-s": true,
  "layout-as-n": true,
};
export const textarea = {
  ...input,
  "layout-r-none": true,
  "layout-fs-c": true,
};

export const button = {
  "typography-f-sf": true,
  "typography-fs-n": true,
  "typography-w-500": true,
  "layout-pt-3": true,
  "layout-pb-3": true,
  "layout-pl-5": true,
  "layout-pr-5": true,
  "layout-mb-1": true,
  "border-br-2": true,
  "border-bw-0": true,
  "border-c-n70": true,
  "border-bs-s": true,
  "color-bgc-s30": true,
  "color-c-n100": true,
  "behavior-ho-80": true,
};

export const heading = {
  "typography-f-sf": true,
  "typography-fs-n": true,
  "typography-w-500": true,
  "layout-mt-0": true,
  "layout-mb-2": true,
};

export const h1 = {
  ...heading,
  "typography-sz-hl": true,
};

export const h2 = {
  ...heading,
  "typography-sz-hm": true,
};

export const h3 = {
  ...heading,
  "typography-sz-hs": true,
};

export const p = {
  "typography-f-s": true,
  "typography-fs-n": true,
  "typography-w-400": true,
  "layout-m-0": true,
  "typography-sz-bm": true,
  "layout-as-n": true,
};

export const body = {
  "typography-f-s": true,
  "typography-fs-n": true,
  "typography-w-400": true,
  "layout-mt-0": true,
  "layout-mb-2": true,
  "typography-sz-bm": true,
};

export const hero = {
  "typography-w-500": true,
  "typography-sz-tl": true,
  "typography-fs-i": true,
};

export const headline = {
  "typography-f-sf": true,
  "typography-fs-i": true,
  "typography-w-500": true,
  "typography-sz-dl": true,
  "layout-r-3": true,
  "layout-b-3": true,
  "color-c-n100": true,
  "layout-mb-0": true,
  "layout-pos-a": true,
};

export const disabled = {
  "opacity-el-50": true,
};

export const card = {
  "border-br-24": true,
  "color-bgc-s80": true,
};

export const list = {
  "border-br-1": true,
  "layout-p-6": true,
  "color-bgc-s50": true,
  "layout-mb-4": true,
};

export const heroImage = {
  "layout-el-cv": true,
  "layout-m-8": true,
};

export const cover = {
  "layout-el-cv": true,
};

export const vertical = {
  "layout-flx-vert": true,
  "layout-g-2": true,
};

export const horizontal = {
  "layout-flx-hor": true,
  "layout-g-2": true,
};

export const segmentVertical = {
  ...vertical,
};

export const segmentVerticalPadded = {
  ...segmentVertical,
  ...{
    "layout-pr-16": true,
    "layout-pt-5": true,
    "layout-pb-6": true,
    "layout-pl-5": true,
  },
};

export const segmentHorizontal = {
  ...horizontal,
};

export const segmentHorizontalPadded = {
  ...segmentHorizontal,
  ...{ "layout-p-3": true },
};

const palette: ColorPalettes = {
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
    p99: "#fffbff",
    p98: "#fcf8ff",
    p95: "#f2efff",
    p90: "#e1e0ff",
    p80: "#c0c1ff",
    p70: "#a0a3ff",
    p60: "#8487ea",
    p50: "#6a6dcd",
    p40: "#5154b3",
    p35: "#4447a6",
    p30: "#383b99",
    p25: "#2c2e8d",
    p20: "#202182",
    p15: "#131178",
    p10: "#06006c",
    p5: "#03004d",
    p0: "#000000",
  },

  secondary: {
    s100: "#ffffff",
    s99: "#fffbff",
    s98: "#fcf8ff",
    s95: "#f2efff",
    s90: "#e2e0f9",
    s80: "#c6c4dd",
    s70: "#aaa9c1",
    s60: "#8f8fa5",
    s50: "#75758b",
    s40: "#5d5c72",
    s35: "#515165",
    s30: "#454559",
    s25: "#393a4d",
    s20: "#2e2f42",
    s15: "#242437",
    s10: "#191a2c",
    s5: "#0f0f21",
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

export const theme: UITheme = {
  elements: {
    input,
    textarea,
    button,
    h1,
    h2,
    h3,
    body,
    p,
  },
  components: {
    card,
    heroImage,
    list,
    segmentVertical,
    segmentVerticalPadded,
    segmentHorizontal,
    segmentHorizontalPadded,
  },
  layouts: {
    vertical,
    verticalPadded: {
      ...vertical,
      "layout-p-3": true,
    },
    horizontal,
    horizontalPadded: {
      ...horizontal,
      "layout-p-3": true,
    },
  },
  modifiers: {
    hero,
    headline,
    disabled,
    cover,
    borderTop: {
      "border-bw-0": true,
      "border-btw-1": true,
      "color-bc-n90": true,
      "border-bs-s": true,
    },
  },
  additionalStyles: {
    ...createThemeStyles(palette),
    "--font-family": '"IBM Plex Serif"',
    "--font-family-flex": '"IBM Plex Serif"',
    "--font-family-code": '"IBM Plex Serif"',
  },
};
