/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeSandbox } from "@breadboard-ai/jsandbox/node";
import {
  addSandboxedRunModule,
  asRuntimeKit,
  type GraphDescriptor,
  type Kit,
  type MutableGraphStore,
} from "@google-labs/breadboard";
import {
  kitFromGraphDescriptor,
  registerKitGraphs,
} from "@google-labs/breadboard/kits";

import Core from "@google-labs/core-kit";
import GeminiKit from "@google-labs/gemini-kit";
import JSONKit from "@google-labs/json-kit";
import TemplateKit from "@google-labs/template-kit";

import GoogleDriveKit from "@breadboard-ai/google-drive-kit/google-drive.kit.json" with { type: "json" };

export { registerLegacyKits };

function registerLegacyKits(graphStore: MutableGraphStore) {
  registerKitGraphs([GoogleDriveKit] as GraphDescriptor[], graphStore);
}

export const createKits = (overrides: Kit[] = []) => {
  const kits = [
    asRuntimeKit(Core),
    asRuntimeKit(JSONKit),
    asRuntimeKit(TemplateKit),
    asRuntimeKit(GeminiKit),
  ];

  const googleDriveKit = kitFromGraphDescriptor(
    GoogleDriveKit as GraphDescriptor
  );
  if (googleDriveKit) {
    kits.push(googleDriveKit);
  }
  return addSandboxedRunModule(new NodeSandbox(), [...overrides, ...kits]);
};
