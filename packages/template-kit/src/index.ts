/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeFactoryFromDefinition } from "@breadboard-ai/build";
import { addKit } from "@google-labs/breadboard";
import { KitBuilder } from "@google-labs/breadboard/kits";
import promptTemplate from "./nodes/prompt-template.js";
import urlTemplate from "./nodes/url-template.js";
export { prompt, promptPlaceholder } from "./nodes/prompt-template-tag.js";
export { default as promptTemplate } from "./nodes/prompt-template.js";
export { default as urlTemplate } from "./nodes/url-template.js";

const builder = new KitBuilder({
  title: "Template Kit",
  description: "A kit that contains nodes for various sorts of templating.",
  version: "0.0.1",
  url: "npm:@google-labs/template-kit",
});

export const TemplateKit = builder.build({
  promptTemplate,
  urlTemplate,
});

export type TemplateKit = InstanceType<typeof TemplateKit>;

export default TemplateKit;

export type TemplateKitType = {
  promptTemplate: NodeFactoryFromDefinition<typeof promptTemplate>;
  urlTemplate: NodeFactoryFromDefinition<typeof urlTemplate>;
};

/**
 * The Template Kit. Use members of this object to create nodes for templating.
 *
 * There are currently two members: `promptTemplate` and `urlTemplate`.
 *
 * The `promptTemplate` creates nodes for simple handlebar-style templates and
 * the `urlTemplate` creates nodes for safely constructing URLs.
 */
export const templates = addKit(TemplateKit) as TemplateKitType;
