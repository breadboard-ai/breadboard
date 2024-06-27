/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import urlTemplate, {
  getUrlTemplateParameters,
} from "../../src/nodes/url-template.js";

test("getUrlTemplateParameters produces valid results", (t) => {
  {
    const template = "https://example.com/{path}";
    const parameters = getUrlTemplateParameters(template);
    t.deepEqual(parameters, [{ name: "path" }]);
  }
  {
    const template = "https://example.com/{/path}";
    const parameters = getUrlTemplateParameters(template);
    t.deepEqual(parameters, [
      {
        name: "path",
        operator: {
          prefix: "/",
          description: "path segment expansion",
        },
      },
    ]);
  }
  {
    const template = "https://example.com/{+path}";
    const parameters = getUrlTemplateParameters(template);
    t.deepEqual(parameters, [
      {
        name: "path",
        operator: {
          prefix: "+",
          description: "reserved expansion",
        },
      },
    ]);
  }
  {
    const template = "https://example.com/path";
    const parameters = getUrlTemplateParameters(template);
    t.deepEqual(parameters, []);
  }
  {
    const template = undefined;
    const parameters = getUrlTemplateParameters(template);
    t.deepEqual(parameters, []);
  }
});

test("`urlTemplateDescriber` produces valid results", async (t) => {
  {
    const description = await urlTemplate.describe({
      template: "https://example.com/{path}",
    });
    t.like(description, {
      inputSchema: {
        type: "object",
        properties: {
          path: {
            title: "path",
            description: 'Value for placeholder "path"',
            type: "string",
          },
          template: {
            title: "Template",
            description: "The URL template to use",
            type: "string",
          },
        },
      },
    });
  }
  {
    const description = await urlTemplate.describe({
      template: "https://example.com/{/path}",
    });
    t.like(description, {
      inputSchema: {
        type: "object",
        properties: {
          path: {
            title: "path",
            description: 'Value for path segment expansion placeholder "path"',
            type: "string",
          },
          template: {
            title: "Template",
            description: "The URL template to use",
            type: "string",
          },
        },
      },
    });
  }
});
