/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import * as ParticlesUI from "@breadboard-ai/particles-ui";

export const themeContext = createContext<
  ParticlesUI.Types.UITheme | undefined
>("UITheme");
