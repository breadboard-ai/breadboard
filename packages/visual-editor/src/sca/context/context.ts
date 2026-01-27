/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { SCA } from "../sca.js";

export const scaContext = createContext<SCA | undefined>("SCA");
