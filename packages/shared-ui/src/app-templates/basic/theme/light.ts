/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as ParticlesUI from "@breadboard-ai/particles-ui";
import {
  a,
  audio,
  body,
  borderTop,
  button,
  card,
  clone,
  cover,
  disabled,
  download,
  h1,
  h2,
  h3,
  headline,
  hero,
  horizontal,
  icon,
  iframe,
  input,
  list,
  listItem,
  listItems,
  media,
  orderedList,
  p,
  ParticleUIAudio,
  ParticleUIFile,
  ParticleUIGoogleDrive,
  ParticleUIImage,
  ParticleUIText,
  ParticleUIVideo,
  pre,
  segmentHorizontal,
  segmentHorizontalPadded,
  segmentVertical,
  segmentVerticalPadded,
  textarea,
  unorderedList,
  vertical,
  video,
} from "./shared.js";

const aLight = ParticlesUI.Utils.merge(a, { "color-c-n5": true });
const inputLight = ParticlesUI.Utils.merge(input, { "color-c-n5": true });
const textareaLight = ParticlesUI.Utils.merge(textarea, { "color-c-n5": true });
const buttonLight = ParticlesUI.Utils.merge(button, { "color-c-n100": true });
const h1Light = ParticlesUI.Utils.merge(h1, { "color-c-n5": true });
const h2Light = ParticlesUI.Utils.merge(h2, { "color-c-n5": true });
const h3Light = ParticlesUI.Utils.merge(h3, { "color-c-n5": true });
const bodyLight = ParticlesUI.Utils.merge(body, { "color-c-n5": true });
const pLight = ParticlesUI.Utils.merge(p, { "color-c-n35": true });
const preLight = ParticlesUI.Utils.merge(pre, { "color-c-n35": true });
const orderedListLight = ParticlesUI.Utils.merge(orderedList, {
  "color-c-n35": true,
});
const unorderedListLight = ParticlesUI.Utils.merge(unorderedList, {
  "color-c-n35": true,
});
const listItemLight = ParticlesUI.Utils.merge(listItem, {
  "color-c-n35": true,
});

export const theme: ParticlesUI.Types.UITheme = {
  elements: {
    a: aLight,
    audio,
    body: bodyLight,
    button: buttonLight,
    h1: h1Light,
    h2: h2Light,
    h3: h3Light,
    iframe,
    input: inputLight,
    p: pLight,
    pre: preLight,
    textarea: textareaLight,
    video,
  },
  extras: {
    icon,
  },
  behaviors: {
    clone,
    delete: {},
    download,
    editable: {},
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
    borderTop,
    media,
  },
  groups: {
    card,
    list,
    listItems,
    segmentVertical,
    segmentVerticalPadded,
    segmentHorizontal,
    segmentHorizontalPadded,
  },
  viewers: {
    "particle-viewer-image": ParticleUIImage,
    "particle-viewer-audio": ParticleUIAudio,
    "particle-viewer-video": ParticleUIVideo,
    "particle-viewer-text": ParticleUIText,
    "particle-viewer-google-drive": ParticleUIGoogleDrive,
    "particle-viewer-file": ParticleUIFile,
  },
  markdown: {
    p: [...Object.keys(pLight), "layout-mb-2"],
    h1: [...Object.keys(h1Light), "layout-mb-2"],
    h2: [...Object.keys(h2Light), "layout-mb-2"],
    h3: [...Object.keys(h3Light), "layout-mb-2"],
    h4: [],
    h5: [],
    h6: [],
    ul: [...Object.keys(unorderedListLight), "layout-mb-2"],
    ol: [...Object.keys(orderedListLight), "layout-mb-2"],
    li: [...Object.keys(listItemLight), "layout-mb"],
    a: [...Object.keys(aLight)],
    strong: [],
    em: [],
  },
};
