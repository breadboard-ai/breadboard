/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { TokenVendor } from "@breadboard-ai/connection-client";

export const tokenVendorContext = createContext<TokenVendor>("TokenVendor");
