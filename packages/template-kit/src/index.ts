/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";
import promptTemplate from "./nodes/prompt-template.js";

import urlTemplate from "./nodes/url-template.js";

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

/**
 * This is a wrapper around existing kits for the new syntax to add types.
 *
 * This should transition to a codegen step, with typescript types constructed
 * from .describe() calls.
 */
import {
  addKit,
  NewNodeValue as NodeValue,
  NewNodeFactory as NodeFactory,
} from "@google-labs/breadboard";

export const templates = addKit(TemplateKit) as unknown as {
  promptTemplate: NodeFactory<
    { template: string; [key: string]: NodeValue },
    { prompt: string }
  >;
  urlTemplate: NodeFactory<
    { template: string; [key: string]: NodeValue },
    { url: string }
  >;
};
