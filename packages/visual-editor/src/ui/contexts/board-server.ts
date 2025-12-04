/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { type BoardServer } from "@google-labs/breadboard";

/** The current board server. */
export const boardServerContext = createContext<BoardServer | undefined>(
  "bb-board-server"
);
