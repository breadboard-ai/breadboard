/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { type UITheme } from "../types/types.js";

export const themeContext = createContext<UITheme | undefined>("UITheme");
