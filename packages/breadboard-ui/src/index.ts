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
export { UI } from "./ui.js";
export { BoardList } from "./board-list.js";
export { JSONTree } from "./json-tree.js";
export { HistoryTree } from "./history-tree.js";

export { Output } from "./output.js";
import {
  MultipartInput,
  MultipartInputImage,
  MultipartInputText,
} from "./input-multipart.js";
import { Diagram } from "./diagram.js";

export const register = () => {
  customElements.define("bb-diagram", Diagram);
  customElements.define("bb-multipart-input", MultipartInput);
  customElements.define("bb-multipart-input-image", MultipartInputImage);
  customElements.define("bb-multipart-input-text", MultipartInputText);
};

export type { LoadArgs } from "./load.js";
export type { OutputArgs } from "./output.js";
export type { StartArgs } from "./start.js";
export type { InputArgs } from "./types.js";
export * as Types from "./types.js";
export * as Events from "./events.js";

export { StartEvent, ToastEvent, DelayEvent } from "./events.js";
