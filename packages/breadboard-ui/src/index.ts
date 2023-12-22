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
export { InputContainer } from "./input-container.js";
export { Start } from "./start.js";
export { Progress } from "./progress.js";
export { Result } from "./result.js";

import { Output } from "./output.js";
import { UIController } from "./ui-controller.js";
import {
  MultipartInput,
  MultipartInputImage,
  MultipartInputText,
} from "./input-multipart.js";
import { Diagram } from "./diagram.js";

export const register = () => {
  customElements.define("bb-diagram", Diagram);
  customElements.define("bb-ui", UIController);
  customElements.define("bb-output", Output);
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
