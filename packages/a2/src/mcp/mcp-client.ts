/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RpcSession } from "../a2/rpc";
import {
  CallToolRequest,
  CallToolResponse,
  Implementation,
  InitArguments,
  ListToolsTool,
} from "./types";

export { McpClient };

class McpClient extends RpcSession<InitArguments, Implementation> {
  constructor(
    caps: Capabilities,
    public readonly args: InitArguments
  ) {
    super(caps, "/mnt/mcp/session");
  }

  protected createSessionKey(): string {
    return this.args.url;
  }
  protected getInitArgs(): InitArguments {
    return this.args;
  }

  async listTools() {
    return this.call<JsonSerializable, ListToolsTool[]>("listTools", {});
  }

  async callTool(args: CallToolRequest) {
    return this.call<CallToolRequest, CallToolResponse>("callTool", args);
  }
}
