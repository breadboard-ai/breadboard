/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { ErrorMessage } from "./error.js";
export { Toast } from "./toast.js";
export { Done } from "./done.js";
export { Input } from "./input.js";
export { WebcamInput } from "./webcam.js";
export { DrawableInput } from "./drawable.js";
export { HistoryEntry } from "./history-entry.js";
export { Load } from "./load.js";

import { Output } from "./output.js";
import { Progress } from "./progress.js";
import { Result } from "./result.js";
import { Start } from "./start.js";
import { UIController } from "./ui-controller.js";
import {
  MultipartInput,
  MultipartInputImage,
  MultipartInputText,
} from "./input-multipart.js";
import { InputContainer } from "./input-container.js";
import { Diagram } from "./diagram.js";

export const register = () => {
  customElements.define("bb-diagram", Diagram);
  customElements.define("bb-input-container", InputContainer);
  customElements.define("bb-ui", UIController);
  customElements.define("bb-start", Start);
  customElements.define("bb-output", Output);
  customElements.define("bb-progress", Progress);
  customElements.define("bb-result", Result);
  customElements.define("bb-multipart-input", MultipartInput);
  customElements.define("bb-multipart-input-image", MultipartInputImage);
  customElements.define("bb-multipart-input-text", MultipartInputText);
};

export const get = () => {
  return document.querySelector("bb-ui") as UIController;
};

export type { LoadArgs } from "./load.js";
export type { OutputArgs } from "./output.js";
export type { InputArgs } from "./input.js";
export type { ResultArgs } from "./result.js";
export type { StartArgs } from "./start.js";
export type { HarnessEventType } from "./types.js";

export { StartEvent, ToastEvent, DelayEvent } from "./events.js";
