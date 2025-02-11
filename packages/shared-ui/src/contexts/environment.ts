/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { InputPlugin } from "../plugins/input-plugin.js";

export interface Environment {
  connectionServerUrl: string | undefined;
  connectionRedirectUrl: string;
  requiresSignin?: boolean;
  plugins: {
    input: InputPlugin[];
  };
}

export const environmentContext = createContext<Environment>("bb-environment");
