/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { Project } from "../state/types";

/** The current global UI state. */
export const projectStateContext = createContext<Project | undefined>(
  "bb-project-state"
);
