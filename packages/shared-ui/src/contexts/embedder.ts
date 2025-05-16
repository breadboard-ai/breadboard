/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import type { EmbedState } from "@breadboard-ai/embed";

export const embedderContext = createContext<EmbedState | undefined>(
  "bb-embedder"
);
