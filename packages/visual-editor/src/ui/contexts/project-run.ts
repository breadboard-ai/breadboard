/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { ProjectRun } from "../state";

export const projectRunContext = createContext<ProjectRun | null>(
  "bb-project-run"
);
