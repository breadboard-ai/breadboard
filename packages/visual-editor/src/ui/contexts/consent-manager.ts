/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { type ConsentManager } from "../utils/consent-manager.js";

/** The consent manager for the project. */
export const consentManagerContext = createContext<ConsentManager | undefined>(
  "bb-consent-manager"
);
