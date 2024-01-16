/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO: Migrate these to Lit Element and remove them from here.
import {
  MultipartInput,
  MultipartInputImage,
  MultipartInputText,
} from "./elements/input/input-multipart/input-multipart.js";
import { Diagram } from "./elements/diagram/diagram.js";

export const register = () => {
  customElements.define("bb-diagram", Diagram);
  customElements.define("bb-multipart-input", MultipartInput);
  customElements.define("bb-multipart-input-image", MultipartInputImage);
  customElements.define("bb-multipart-input-text", MultipartInputText);
};

export * as Types from "./types/types.js";
export * as Events from "./events/events.js";
export * as Elements from "./elements/elements.js";
