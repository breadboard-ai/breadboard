/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { UITheme } from "../theme/default";

export const themeContext = createContext<UITheme | undefined>("UITheme");
