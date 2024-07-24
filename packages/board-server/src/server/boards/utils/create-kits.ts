/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import AgentKit from "@google-labs/agent-kit/agent.kit.json" with { type: "json" };
import { asRuntimeKit, type KitManifest } from "@google-labs/breadboard";
import { fromManifest } from "@google-labs/breadboard/kits";
import Core from "@google-labs/core-kit";
import GeminiKit from "@google-labs/gemini-kit";
import JSONKit from "@google-labs/json-kit";
import TemplateKit from "@google-labs/template-kit";
import { secretsKit } from "../../proxy/secrets.js";

export const createKits = () => [
  secretsKit,
  asRuntimeKit(Core),
  asRuntimeKit(JSONKit),
  asRuntimeKit(TemplateKit),
  asRuntimeKit(GeminiKit),
  fromManifest(AgentKit as KitManifest),
];
