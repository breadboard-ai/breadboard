/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { addKit, type NewNodeFactory } from "@google-labs/breadboard";
import { GraphToKitAdapter, KitBuilder } from "@google-labs/breadboard/kits";
import { kit } from "./kit.js";

const KIT_BASE_URL =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/google-drive-kit/graphs/kit.json";

const adapter = await GraphToKitAdapter.create(kit, KIT_BASE_URL, []);

const builder = new KitBuilder(
  adapter.populateDescriptor({
    url: "npm:@breadboard-ai/google-drive-kit",
  })
);

const GooogleDriveKit = builder.build({
  exportFile: adapter.handlerForNode("exportFile"),
  listFiles: adapter.handlerForNode("listFiles"),
});

export type GooogleDriveKit = InstanceType<typeof GooogleDriveKit>;

export type GooogleDriveKitType = {
  exportFile: NewNodeFactory<{
    // TODO(aomarks) Generate this?
  }>;
  listFiles: NewNodeFactory<{
    // TODO(aomarks) Generate this?
  }>;
};

export default GooogleDriveKit;

export const googleDrive = addKit(
  GooogleDriveKit
) as unknown as GooogleDriveKitType;
