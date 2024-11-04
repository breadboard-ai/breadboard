/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeSandbox } from "@breadboard-ai/jsandbox/node";
import AgentKit from "@google-labs/agent-kit/agent.kit.json" with { type: "json" };
import GoogleDriveKit from "@breadboard-ai/google-drive-kit/google-drive.kit.json" with { type: "json" };
import {
  asRuntimeKit,
  type Kit,
  type KitManifest,
} from "@google-labs/breadboard";
import { fromManifest } from "@google-labs/breadboard/kits";
import Core, { addSandboxedRunModule } from "@google-labs/core-kit";
import GeminiKit from "@google-labs/gemini-kit";
import JSONKit from "@google-labs/json-kit";
import TemplateKit from "@google-labs/template-kit";

export const createKits = (overrides: Kit[] = []) =>
  addSandboxedRunModule(new NodeSandbox(), [
    ...overrides,
    asRuntimeKit(Core),
    asRuntimeKit(JSONKit),
    asRuntimeKit(TemplateKit),
    asRuntimeKit(GeminiKit),
    fromManifest(AgentKit as KitManifest),
    fromManifest(GoogleDriveKit as KitManifest),
  ]);
