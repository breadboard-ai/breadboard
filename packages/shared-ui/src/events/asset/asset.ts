/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetEdge } from "../../types/types";

type Namespace = "asset";

export interface ChangeEdge {
  readonly eventType: `${Namespace}.changeedge`;
  readonly changeType: "add" | "remove";
  readonly assetEdge: AssetEdge;
  readonly subGraphId: string | null;
}
