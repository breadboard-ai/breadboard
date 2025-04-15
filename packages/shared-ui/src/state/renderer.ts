/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConnectorState, RendererState } from "./types";

export { RendererStateImpl };

class RendererStateImpl implements RendererState {
  constructor(public readonly connectors: ConnectorState) {}
}
