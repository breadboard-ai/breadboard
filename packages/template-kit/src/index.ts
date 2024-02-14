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

export type TemplateKitType = {
  /**
   * Use this node to populate simple handlebar-style templates. A required
   * input is `template`, which is a string that contains the template prompt
   * template. The template can contain zero or more placeholders that will be
   * replaced with values from inputs. Specify placeholders as `{{inputName}}`
   * in the template. The placeholders in the template must match the inputs
   * wired into this node. The node will replace all placeholders with values
   * from the input property bag and pass the result along as the `prompt`
   * output property.
   */
  promptTemplate: NodeFactory<
    {
      /**
       * The template to use for the prompt.
       */
      template: string;
      /**
       * The values to fill in the template.
       */
      [key: string]: NodeValue;
    },
    | {
        /**
         * The result of template with placeholders being replaced with values.
         */
        prompt: string;
      }
    | {
        /**
         * The result of template with placeholders being replaced with values.
         */
        text: string;
      }
  >;
  /**
   * Use this node to safely construct URLs. This node relies on the
   * [URI template specification](https://tools.ietf.org/html/rfc6570) to
   * construct URLs, so the syntax is using single curly braces instead of
   * double curly braces.
   */
  urlTemplate: NodeFactory<
    {
      /**
       * The URL template to use for the URL.
       */
      template: string;
      /**
       * Values for the template placeholders.
       */
      [key: string]: NodeValue;
    },
    {
      /**
       * The result of the URL template with placeholders being replaced with
       * values.
       */
      url: string;
    }
  >;
};

/**
 * The Template Kit. Use members of this object to create nodes for templating.
 *
 * There are currently two members: `promptTemplate` and `urlTemplate`.
 *
 * The `promptTemplate` creates nodes for simple handlebar-style templates and
 * the `urlTemplate` creates nodes for safely constructing URLs.
 *
 */
export const templates = addKit(TemplateKit) as unknown as TemplateKitType;
