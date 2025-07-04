/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditSpec,
  NodeConfiguration,
  NodeMetadata,
} from "@breadboard-ai/types";

type Namespace = "node";

export interface Change {
  readonly eventType: `${Namespace}.change`;
  readonly id: string;
  readonly configurationPart: NodeConfiguration;
  readonly subGraphId: string | null;
  readonly metadata: NodeMetadata | null;
  readonly ins: { path: string; title: string }[] | null;
}

export interface MultiChange {
  readonly eventType: `${Namespace}.multichange`;
  readonly edits: EditSpec[];
  readonly description: string;
  readonly subGraphId: string | null;
}
