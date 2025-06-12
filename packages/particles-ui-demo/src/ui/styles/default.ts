/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { behavior } from "./behavior";
import { border } from "./border";
import { colors } from "./colors";
import { CSSResultGroup } from "lit";
import { layout } from "./layout";
import { type } from "./type";
import { opacity } from "./opacity";

export const styles: CSSResultGroup = [
  border,
  behavior,
  colors,
  layout,
  type,
  opacity,
];

const input = {
  "typography-f-sf": true,
  "layout-p-3": true,
  "layout-mb-1": true,
  "border-br-3": true,
  "border-bw-1": true,
  "border-bc-n70": true,
  "border-bs-s": true,
};
const textarea = {
  ...input,
  "layout-r-none": true,
  "layout-fs-c": true,
};

const button = {
  "typography-f-sf": true,
  "typography-w-500": true,
  "layout-pt-3": true,
  "layout-pb-3": true,
  "layout-pl-5": true,
  "layout-pr-5": true,
  "layout-mb-1": true,
  "border-br-16": true,
  "layout-r-none": true,
  "border-bw-0": true,
  "border-c-n70": true,
  "border-bs-s": true,
  "layout-fs-c": true,
  "color-bgc-n0": true,
  "color-c-n100": true,
  "behavior-ho-80": true,
};

const heading = {
  "typography-f-sf": true,
  "typography-w-500": true,
  "layout-mt-0": true,
  "layout-mb-2": true,
};

const h1 = {
  ...heading,
  "typography-sz-tl": true,
};

const h2 = {
  ...heading,
  "typography-sz-tm": true,
};

const h3 = {
  ...heading,
  "typography-sz-ts": true,
};

const body = {
  "typography-f-s": true,
  "typography-w-400": true,
  "layout-mt-0": true,
  "layout-mb-2": true,
  "typography-sz-bm": true,
};

const hero = {
  "typography-w-500": true,
  "typography-sz-tl": true,
};

const headline = {
  "typography-f-sf": true,
  "typography-w-400": true,
  "typography-sz-dl": true,
  "layout-l-3": true,
  "layout-b-3": true,
  "color-c-n100": true,
  "layout-mb-0": true,
  "layout-pos-a": true,
};

const disabled = {
  "opacity-el-70": true,
};

const card = {
  "border-br-4": true,
};

const heroImage = {
  "border-br-4": true,
};

const cover = {
  "layout-el-cv": true,
};

const vertical = {
  "layout-flx-vert": true,
};

const horizontal = {
  "layout-flx-hor": true,
};

export const theme = {
  elements: {
    input,
    textarea,
    button,
    h1,
    h2,
    h3,
    body,
  },
  components: {
    card,
    heroImage,
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
};

export type UITheme = typeof theme;
