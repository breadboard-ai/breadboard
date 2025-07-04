/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeConfiguration, NodeMetadata } from "@breadboard-ai/types";

type Namespace = "node";

export interface Change {
  readonly eventType: `${Namespace}.change`;
  readonly id: string;
  readonly configurationPart: NodeConfiguration;
  readonly subGraphId: string | null;
  readonly metadata: NodeMetadata | null;
  readonly ins: { path: string; title: string }[] | null;
}
