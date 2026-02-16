/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities } from "@breadboard-ai/types/capabilities.js";
import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { A2ModuleArgs } from "../src/a2/runnable-module-factory.js";
import { AgentContext } from "../src/a2/agent/agent-context.js";
import { McpClientManager } from "../src/mcp/client-manager.js";
import {
  MemoryManager,
  SheetMetadataWithFilePath,
} from "../src/a2/agent/types.js";
import { Outcome } from "@breadboard-ai/types";
import { type ConsentController } from "../src/sca/controller/subcontrollers/global/global.js";

export { stubCaps, stubModuleArgs, stubMemoryManager };

const stubCaps: Capabilities = {
  read() {
    throw new Error(`Not implemented`);
  },
  async write() {
    // Do nothing
  },
};

const stubModuleArgs: A2ModuleArgs = {
  mcpClientManager: {} as unknown as McpClientManager,
  agentContext: new AgentContext({
    shell: {} as unknown as OpalShellHostProtocol,
    fetchWithCreds: () => {
      throw new Error(`fetchWithCreds not implemented`);
    },
  }),
  fetchWithCreds: () => {
    throw new Error(`fetchWithCreds not implemented`);
  },
  context: {},
  shell: {} as unknown as OpalShellHostProtocol,
  getConsentController() {
    return {
      async queryConsent() {
        return true;
      },
    } as Partial<ConsentController> as ConsentController;
  },
  notebookLmApiClient: {} as never,
};

const stubMemoryManager: MemoryManager = {
  createSheet: () => {
    throw new Error(`Not implemented`);
  },
  readSheet: async () => {
    return { values: [] };
  },
  updateSheet: () => {
    throw new Error(`Not implemented`);
  },
  deleteSheet: () => {
    throw new Error(`Not implemented`);
  },
  appendToSheet: async () => {
    return { success: true };
  },
  ensureSystemSheet: async () => {
    return { success: true };
  },
  getSheetMetadata: function (): Promise<
    Outcome<{ sheets: SheetMetadataWithFilePath[] }>
  > {
    throw new Error("Function not implemented.");
  },
};
