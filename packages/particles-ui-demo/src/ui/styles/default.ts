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
  "sans-flex": true,
  "padding-3": true,
  "margin-bottom-1": true,
  "border-radius-3": true,
  "border-width-1": true,
  "border-color-n-70": true,
  "border-style-solid": true,
};
const textarea = {
  ...input,
  "resize-none": true,
  "field-sizing-content": true,
};

const button = {
  "sans-flex": true,
  "w-500": true,
  "padding-top-3": true,
  "padding-bottom-3": true,
  "padding-left-5": true,
  "padding-right-5": true,
  "margin-bottom-1": true,
  "border-radius-16": true,
  "resize-none": true,
  "border-width-0": true,
  "border-color-n-70": true,
  "border-style-solid": true,
  "field-sizing-content": true,
  "background-color-n-0": true,
  "color-n-100": true,
  "behavior-hover": true,
};

const heading = {
  "sans-flex": true,
  "w-500": true,
  "margin-top-0": true,
  "margin-bottom-2": true,
};

const h1 = {
  ...heading,
  "title-large": true,
};

const h2 = {
  ...heading,
  "title-medium": true,
};

const h3 = {
  ...heading,
  "title-small": true,
};

const body = {
  "sans-flex": true,
  "w-400": true,
  "margin-top-0": true,
  "margin-bottom-2": true,
  "body-medium": true,
};

const hero = {
  "w-500": true,
  "title-large": true,
};

const headline = {
  "w-400": true,
  "display-large": true,
  "left-3": true,
  "bottom-3": true,
  "color-n-100": true,
  "margin-bottom-0": true,
  "position-absolute": true,
};

const disabled = {
  "opacity-70": true,
};

export const defaultStyles = {
  elements: {
    input,
    textarea,
    button,
    h1,
    h2,
    h3,
    body,
  },
  extras: {
    hero,
    headline,
    disabled,
  },
};
