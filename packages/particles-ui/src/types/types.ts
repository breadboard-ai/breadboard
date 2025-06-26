/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Field,
  FieldName,
  Orientation,
  Presentation,
} from "@breadboard-ai/particles";

export type ItemData = Record<string, string | boolean | Date>;

export type ItemState = {
  data: ItemData | undefined;
  presentation: Presentation;
};

export type ItemList = {
  items: Map<string, ItemState>;
  presentation: Presentation;
};

export type TodoItemListTitle = string;

export interface ParticleUIElement extends HTMLElement {
  fieldName: FieldName | null;
  field: Field | null;
  value: ItemData[string] | null; // TODO: Migrate this to a Particle.
  containerOrientation: Orientation | null;
}

export type UITheme = {
  groups: {
    card: Record<string, boolean>;
    list: Record<string, boolean>;
    listItems: Record<string, boolean>;
    segmentVertical: Record<string, boolean>;
    segmentVerticalPadded: Record<string, boolean>;
    segmentHorizontal: Record<string, boolean>;
    segmentHorizontalPadded: Record<string, boolean>;
  };
  viewers: Record<string, Record<string, boolean>>;
  elements: {
    a: Record<string, boolean>;
    audio: Record<string, boolean>;
    body: Record<string, boolean>;
    button: Record<string, boolean>;
    h1: Record<string, boolean>;
    h2: Record<string, boolean>;
    h3: Record<string, boolean>;
    iframe: Record<string, boolean>;
    input: Record<string, boolean>;
    p: Record<string, boolean>;
    pre: Record<string, boolean>;
    textarea: Record<string, boolean>;
    video: Record<string, boolean>;
  };
  layouts: {
    vertical: Record<string, boolean>;
    verticalPadded: Record<string, boolean>;
    horizontal: Record<string, boolean>;
    horizontalPadded: Record<string, boolean>;
  };
  modifiers: {
    hero: Record<string, boolean>;
    headline: Record<string, boolean>;
    disabled: Record<string, boolean>;
    cover: Record<string, boolean>;
    borderTop: Record<string, boolean>;
    media: Record<string, boolean>;
  };
  markdown: {
    p: string[];
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
    ul: string[];
    ol: string[];
    li: string[];
    a: string[];
    strong: string[];
    em: string[];
  };
  additionalStyles?: Record<string, string>;
};
