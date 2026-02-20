/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeHandlerContext } from "@breadboard-ai/types";

import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { McpClientManager } from "../mcp/index.js";
import { type ConsentController } from "../sca/controller/subcontrollers/global/global.js";
import { AgentContext } from "./agent/agent-context.js";
import { NotebookLmApiClient } from "../sca/services/notebooklm-api-client.js";
import { AgentService } from "./agent/agent-service.js";

export { createA2ModuleFactory, A2ModuleFactory };

export type A2ModuleFactoryArgs = {
  mcpClientManager: McpClientManager;
  fetchWithCreds: typeof globalThis.fetch;
  shell: OpalShellHostProtocol;
  getConsentController: () => ConsentController;
  agentContext: AgentContext;
  agentService: AgentService;
  notebookLmApiClient: NotebookLmApiClient;
};

export type A2ModuleArgs = A2ModuleFactoryArgs & {
  context: NodeHandlerContext;
};

function createA2ModuleFactory(args: A2ModuleFactoryArgs): A2ModuleFactory {
  return new A2ModuleFactory(args);
}

class A2ModuleFactory {
  constructor(private readonly args: A2ModuleFactoryArgs) {}

  /**
   * Creates A2ModuleArgs from NodeHandlerContext.
   * Used for static component dispatch to bypass graph-based handlers.
   */
  createModuleArgs(context: NodeHandlerContext): A2ModuleArgs {
    return { ...this.args, context };
  }
}
