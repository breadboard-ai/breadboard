/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeRunState } from "@breadboard-ai/types";
import { EdgeRunState, RendererRunState } from "./types";
import { SignalMap } from "signal-utils/map";

export { ReactiveRendererRunState };

class ReactiveRendererRunState implements RendererRunState {
  nodes: Map<string, NodeRunState> = new SignalMap();
  edges: Map<string, EdgeRunState> = new SignalMap();
}
