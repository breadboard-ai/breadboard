/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as mcpConfigurator from "./configurator";
import * as mcpConnectorTools from "./connector-tools";
import * as mcpMcpClient from "./mcp-client";
import * as mcpTypes from "./types";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl";

export const exports = {
  configurator: mcpConfigurator,
  "connector-tools": mcpConnectorTools,
  "mcp-client": mcpMcpClient,
  types: mcpTypes,
};

export const bgl = createBgl(descriptor, exports);
