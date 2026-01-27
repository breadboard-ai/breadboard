/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities } from "@breadboard-ai/types/capabilities.js";
import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { A2ModuleArgs } from "../src/a2/runnable-module-factory.js";
import { McpClientManager } from "../src/mcp/client-manager.js";
import {
  MemoryManager,
  SheetMetadataWithFilePath,
} from "../src/a2/agent/types.js";
import { Outcome } from "@breadboard-ai/types";
import { type ConsentController } from "../src/sca/controller/subcontrollers/consent-controller.js";

export { stubCaps, stubModuleArgs, stubMemoryManager };

const stubCaps: Capabilities = {
  invoke() {
    throw new Error(`Not implemented`);
  },
  input() {
    throw new Error(`Not implemented`);
  },
  async output(data) {
    console.log(data.$metadata?.title);
    return { delivered: true };
  },
  describe() {
    throw new Error(`Not implemented`);
  },
  query() {
    throw new Error(`Not implemented`);
  },
  read() {
    throw new Error(`Not implemented`);
  },
  async write() {
    // Do nothing
  },
};

const stubModuleArgs: A2ModuleArgs = {
  mcpClientManager: {} as unknown as McpClientManager,
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
};

const stubMemoryManager: MemoryManager = {
  readSheet: () => {
    throw new Error(`Not implemented`);
  },
  updateSheet: () => {
    throw new Error(`Not implemented`);
  },
  deleteSheet: () => {
    throw new Error(`Not implemented`);
  },
  getSheetMetadata: function (): Promise<
    Outcome<{ sheets: SheetMetadataWithFilePath[] }>
  > {
    throw new Error("Function not implemented.");
  },
};
