/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";
import { Mcp, McpServer, McpServerIdentifier, ProjectInternal } from "./types";
import { SignalMap } from "signal-utils/map";

export { McpImpl };

class McpImpl implements Mcp {
  constructor(private readonly project: ProjectInternal) {}

  servers: ReadonlyMap<string, McpServer> = new SignalMap();

  register(_id: McpServerIdentifier): Promise<Outcome<void>> {
    throw new Error("Method not implemented.");
  }
  unregister(_id: McpServerIdentifier): Promise<Outcome<void>> {
    throw new Error("Method not implemented.");
  }
  add(_url: string, _title: string | undefined): Promise<Outcome<McpServer>> {
    throw new Error("Method not implemented.");
  }
  remove(_id: McpServerIdentifier): Promise<Outcome<void>> {
    throw new Error("Method not implemented.");
  }
  rename(_id: string, _title: string): Promise<Outcome<void>> {
    throw new Error("Method not implemented.");
  }
}
