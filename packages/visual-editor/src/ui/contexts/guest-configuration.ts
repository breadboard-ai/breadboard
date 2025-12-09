/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GuestConfiguration } from "@breadboard-ai/types/opal-shell-protocol.js";
import { createContext } from "@lit/context";

export const guestConfigurationContext = createContext<
  GuestConfiguration | undefined
>("bb-guest-configuration");
