/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetEdge, NewAsset } from "../../types/types.js";
import { BaseEventDetail } from "../base.js";

type Namespace = "asset";

export interface ChangeEdge extends BaseEventDetail<`${Namespace}.changeedge`> {
  readonly changeType: "add" | "remove";
  readonly assetEdge: AssetEdge;
  readonly subGraphId: string | null;
}

export interface Add extends BaseEventDetail<`${Namespace}.add`> {
  readonly assets: NewAsset[];
}
