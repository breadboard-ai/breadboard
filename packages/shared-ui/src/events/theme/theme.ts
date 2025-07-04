/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphTheme } from "@breadboard-ai/types";
import { AppTheme } from "../../types/types";

type Namespace = "theme";

export interface Change {
  readonly eventType: `${Namespace}.change`;
  readonly id: string;
}

export interface Create {
  readonly eventType: `${Namespace}.create`;
  // TODO: Change this over to GraphTheme.
  readonly theme: AppTheme;
}

export interface Delete {
  readonly eventType: `${Namespace}.delete`;
  readonly id: string;
}

export interface Update {
  readonly eventType: `${Namespace}.update`;
  readonly id: string;
  readonly theme: GraphTheme;
}
