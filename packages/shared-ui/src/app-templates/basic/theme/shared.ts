/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const input = {
  "typography-f-sf": true,
  "typography-fs-n": true,
  "typography-w-400": true,
  "layout-pl-4": true,
  "layout-pr-4": true,
  "layout-pt-2": true,
  "layout-pb-2": true,
  "border-br-6": true,
  "border-bw-1": true,
  "color-bc-s70": true,
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
  "border-br-16": true,
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
  "typography-sz-tl": true,
};

export const h2 = {
  ...heading,
  "typography-sz-tm": true,
};

export const h3 = {
  ...heading,
  "typography-sz-ts": true,
};

export const a = {
  "typography-f-sf": true,
  "typography-fs-n": true,
  "typography-w-500": true,
  "layout-as-n": true,
  "layout-dis-iflx": true,
  "layout-al-c": true,
};

export const p = {
  "typography-f-s": true,
  "typography-fs-n": true,
  "typography-w-400": true,
  "layout-m-0": true,
  "typography-sz-bm": true,
  "layout-as-n": true,
};

export const pre = {
  "typography-f-c": true,
  "typography-fs-n": true,
  "typography-w-400": true,
  "typography-sz-bm": true,
  "typography-ws-p": true,
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
  "typography-f-sf": true,
  "typography-w-500": true,
  "typography-sz-hs": true,
  "typography-ta-c": true,
  "typography-v-r": true,
};

export const headline = {
  "typography-f-sf": true,
  "typography-fs-n": true,
  "typography-w-400": true,
  "typography-sz-dl": true,
  "layout-l-3": true,
  "layout-b-3": true,
  "color-c-n100": true,
  "layout-mb-0": true,
  "layout-pos-a": true,
};

export const disabled = {
  "opacity-el-50": true,
};

export const card = {
  "layout-w-100": true,
};

export const list = {
  "layout-p-4": true,
  "layout-g-2": true,
};

export const listItems = {};
export const media = {
  "layout-w-70": true,
  "layout-js-c": true,
  "layout-p-3": true,
};

export const image = {
  "border-br-5": true,
  "layout-el-cv": true,
};

export const iframe = {
  "border-br-5": true,
};

export const video = {
  "border-br-5": true,
  "layout-el-cv": true,
};

export const audio = {
  "layout-w-100": true,
};

export const cover = {
  "layout-el-cv": true,
};

export const vertical = {
  "layout-dsp-flexvert": true,
  "layout-g-2": true,
};

export const horizontal = {
  "layout-dsp-flexhor": true,
  "layout-fw-w": true,
  "layout-g-2": true,
};

export const segmentVertical = {
  ...vertical,
};

export const segmentVerticalPadded = {
  ...segmentVertical,
  ...{ "layout-p-3": true },
};

export const segmentHorizontal = {
  ...horizontal,
};

export const segmentHorizontalPadded = {
  ...segmentHorizontal,
  ...{ "layout-p-3": true },
};
