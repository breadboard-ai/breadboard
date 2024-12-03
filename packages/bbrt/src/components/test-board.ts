/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO(aomarks) Delete this file once we hook up a real graph.

import type { GraphDescriptor } from "@google-labs/breadboard";

export const testBoard: GraphDescriptor = {
  title: "Image Generator DALL-E",
  description: "A tool that will generates an image based on a prompt",
  version: "0.0.1",
  edges: [
    {
      from: "bodyMaker",
      to: "dalleCaller",
      in: "body",
      out: "body",
    },
    {
      from: "dalleCaller",
      to: "responseExtractor",
      in: "response",
      out: "response",
    },
    {
      from: "headerMaker",
      to: "dalleCaller",
      in: "headers",
      out: "headers",
    },
    {
      from: "input-1",
      to: "bodyMaker",
      in: "prompt",
      out: "prompt",
    },
    {
      from: "openaiApiKey",
      to: "headerMaker",
      in: "key",
      out: "OPENAI_API_KEY",
    },
    {
      from: "responseExtractor",
      to: "deflate-7f01863a",
      in: "data",
      out: "response",
    },
    {
      from: "deflate-7f01863a",
      to: "output-2",
      in: "response",
      out: "data",
    },
  ],
  nodes: [
    {
      id: "openaiApiKey",
      type: "secrets",
      configuration: {
        keys: ["OPENAI_API_KEY"],
      },
      metadata: {
        title: "Get OPEN API Key",
        description: "Getting the API key for the OpenAI DALL·E API.",
        visual: {
          x: 1019.0000000000001,
          y: 214,
          collapsed: false,
        },
      },
    },
    {
      id: "input-1",
      type: "input",
      configuration: {
        schema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              title: "Prompt",
              description: "The prompt to generate images from.",
              examples: ["A painting of a breadboard"],
            },
          },
          required: ["prompt"],
        },
      },
      metadata: {
        visual: {
          x: 1025,
          y: -29,
          collapsed: false,
        },
      },
    },
    {
      id: "headerMaker",
      type: "runJavascript",
      configuration: {
        code: 'const headerMaker = ({key})=>{return{headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`}}};',
        name: "headerMaker",
        raw: true,
      },
      metadata: {
        title: "Make Headers",
        description: "Making the headers for the API request",
        visual: {
          x: 1098.4092386469215,
          y: 139.2349466727236,
          collapsed: false,
        },
      },
    },
    {
      id: "bodyMaker",
      type: "runJavascript",
      configuration: {
        code: 'const bodyMaker = ({prompt})=>{return{body:{model:"dall-e-3",response_format:"b64_json",prompt}}};',
        name: "bodyMaker",
        raw: "on",
      },
      metadata: {
        title: "Make Body",
        description: "Making the body for the API request",
        visual: {
          x: 1107.4092386469215,
          y: 56.23494667272365,
          collapsed: false,
        },
      },
    },
    {
      id: "dalleCaller",
      type: "fetch",
      configuration: {
        method: "POST",
        url: "https://api.openai.com/v1/images/generations",
      },
      metadata: {
        title: "Call OpenAI DALL·E",
        description:
          "Calling the OpenAI DALL·E API to generate images from text.",
        visual: {
          x: 1367.4092386469215,
          y: 139.2349466727236,
          collapsed: false,
        },
      },
    },
    {
      id: "responseExtractor",
      type: "runJavascript",
      configuration: {
        code: 'const responseExtractor = ({response})=>{const{data}=response;return {\n  response: {\n    parts: [{\n      inlineData: {\n        mimeType: "image/png",\n        data: data[0].b64_json\n      }\n    }],\n    "role": "user"\n  }\n}};',
        name: "responseExtractor",
        raw: "on",
      },
      metadata: {
        title: "Extract Response",
        description: "Extracting the response from the API call",
        visual: {
          x: 1486,
          y: 210.0000000000001,
          collapsed: false,
        },
      },
    },
    {
      id: "deflate-7f01863a",
      type: "deflate",
      metadata: {
        visual: {
          x: 1605.0000000000005,
          y: 273.0000000000001,
          collapsed: false,
        },
        title: "Store Images",
        logLevel: "debug",
      },
    },
    {
      id: "output-2",
      type: "output",
      configuration: {
        schema: {
          type: "object",
          properties: {
            response: {
              type: "object",
              behavior: ["llm-content"],
              title: "response",
              examples: [],
            },
          },
          required: [],
        },
      },
      metadata: {
        visual: {
          x: 1814.0000000000005,
          y: 271,
          collapsed: false,
        },
      },
    },
  ],
  metadata: {
    tags: ["published", "tool"],
  },
  url: "https://breadboard.live/boards/@aaron/image-generator-dall-e.bgl.json",
};
