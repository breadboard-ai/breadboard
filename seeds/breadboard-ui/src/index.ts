/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorMessage } from "./error.js";
import { Input } from "./input.js";
import { Load } from "./load.js";
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
import { Toast } from "./toast.js";
import { InputContainer } from "./input-container.js";
import { Done } from "./done.js";
import { Diagram } from "./diagram.js";
import { HistoryEntry } from "./history-entry.js";
import { Webcam } from "./webcam.js";
import { Drawable } from "./drawable.js";

export const register = () => {
  customElements.define("bb-webcam", Webcam);
  customElements.define("bb-drawable", Drawable);
  customElements.define("bb-history-entry", HistoryEntry);
  customElements.define("bb-diagram", Diagram);
  customElements.define("bb-input-container", InputContainer);
  customElements.define("bb-ui", UIController);
  customElements.define("bb-start", Start);
  customElements.define("bb-load", Load);
  customElements.define("bb-error", ErrorMessage);
  customElements.define("bb-input", Input);
  customElements.define("bb-output", Output);
  customElements.define("bb-progress", Progress);
  customElements.define("bb-result", Result);
  customElements.define("bb-done", Done);
  customElements.define("bb-multipart-input", MultipartInput);
  customElements.define("bb-multipart-input-image", MultipartInputImage);
  customElements.define("bb-multipart-input-text", MultipartInputText);
  customElements.define("bb-toast", Toast);
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
