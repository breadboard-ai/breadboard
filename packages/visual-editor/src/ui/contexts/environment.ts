/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";

export interface Environment {
  connectionServerUrl: string | undefined;
  connectionRedirectUrl: string;
}

export const environmentContext = createContext<Environment>("bb-environment");
