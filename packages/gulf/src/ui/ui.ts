/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type TagName = keyof GulfTagNameMap;

// A type that describes a constructor function which returns an instance of T
export type CustomElementConstructorOf<T extends HTMLElement> = {
  // The 'new' signature ensures it can be instantiated
  new (): T;
} & typeof HTMLElement;

import { Button } from "./button.js";
import { Card } from "./card.js";
import { Carousel } from "./carousel.js";
import { Divider } from "./divider.js";
import { Image } from "./image.js";
import { List } from "./list.js";
import { MultipleChoice } from "./multiple-choice.js";
import { Root } from "./root.js";
import { TextField } from "./text-field.js";
import { Text } from "./text.js";

export {
  Button,
  Card,
  Carousel,
  Divider,
  Image,
  List,
  MultipleChoice,
  Root,
  Text,
  TextField,
};

interface GulfTagNameMap {
  "gulf-root": Root;
  "gulf-card": Card;
  "gulf-list": List;
  "gulf-button": Button;
  "gulf-carousel": Carousel;
  "gulf-divider": Divider;
  "gulf-image": Image;
  "gulf-multiplechoice": MultipleChoice;
  "gulf-text": Text;
  "gulf-textfield": TextField;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface HTMLElementTagNameMap extends GulfTagNameMap {}
}

/**
 * Type-safely retrieves a custom element constructor using the tagName map.
 * @param tagName The tag name to look up (must exist in HTMLElementTagNameMap).
 * @returns The specific constructor type or undefined.
 */
export function instanceOf<T extends keyof GulfTagNameMap>(tagName: T) {
  // Use a type assertion: we tell TypeScript to trust that the value returned
  // by customElements.get(tagName) matches the type defined in our map.
  const ctor = customElements.get(tagName) as
    | CustomElementConstructorOf<GulfTagNameMap[T]>
    | undefined;
  if (!ctor) {
    console.warn("No element definition for", tagName);
    return;
  }

  return new ctor();
}
