/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as gmailConfigurator from "./configurator";
import * as gmailGetEmails from "./get-emails";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl";

export const exports = {
  configurator: gmailConfigurator,
  "get-emails": gmailGetEmails,
};

export const bgl = createBgl(descriptor, exports);
