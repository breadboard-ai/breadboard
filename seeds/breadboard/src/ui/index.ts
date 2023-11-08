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
import { Diagram } from "./diagram.js";
import { UIController } from "./ui-controller.js";

export const register = () => {
  customElements.define("bb-ui", UIController);
  customElements.define("bb-start", Start);
  customElements.define("bb-diagram", Diagram);
  customElements.define("bb-load", Load);
  customElements.define("bb-error", ErrorMessage);
  customElements.define("bb-input", Input);
  customElements.define("bb-output", Output);
  customElements.define("bb-progress", Progress);
  customElements.define("bb-result", Result);
};

export const get = () => {
  return document.querySelector("bb-ui") as UIController;
};
