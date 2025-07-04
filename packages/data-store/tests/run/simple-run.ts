/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "@breadboard-ai/types";

export const results: HarnessRunResult[] = [
  {
    type: "graphstart",
    data: {
      graph: {
        url: "idb://default/blank-board.bgl.json",
        title: "Blank board",
        description:
          "A blank board. Use it as a starting point for your creations.",
        $schema:
          "https://raw.githubusercontent.com/breadboard-ai/breadboard/@google-labs/breadboard-schema@1.5.1/packages/schema/breadboard.schema.json",
        version: "0.0.1",
        edges: [
          {
            from: "input-45dd0a3d",
            to: "output-b8d7ce06",
            out: "content",
            in: "content",
          },
        ],
        nodes: [
          {
            id: "output-b8d7ce06",
            type: "output",
            metadata: { visual: { x: 340, y: 169, collapsed: false } },
            configuration: {
              schema: {
                properties: {
                  content: {
                    type: "object",
                    title: "Content",
                    examples: [],
                    behavior: ["llm-content"],
                  },
                },
                type: "object",
                required: [],
              },
            },
          },
          {
            id: "input-45dd0a3d",
            type: "input",
            metadata: { visual: { x: 54, y: 193, collapsed: false } },
            configuration: {
              schema: {
                properties: {
                  content: {
                    type: "object",
                    title: "Content",
                    examples: [],
                    behavior: ["llm-content"],
                  },
                },
                type: "object",
                required: [],
              },
            },
          },
        ],
        kits: [],
      },
      path: [],
      graphId: "",
      timestamp: 2448.5,
    },
    async reply() {},
  },
  {
    type: "nodestart",
    data: {
      node: {
        id: "input-45dd0a3d",
        type: "input",
        metadata: { visual: { x: 54, y: 193, collapsed: false } },
        configuration: {
          schema: {
            properties: {
              content: {
                type: "object",
                title: "Content",
                examples: [],
                behavior: ["llm-content"],
              },
            },
            type: "object",
            required: [],
          },
        },
      },
      inputs: {
        schema: {
          properties: {
            content: {
              type: "object",
              title: "Content",
              examples: [],
              behavior: ["llm-content"],
            },
          },
          type: "object",
          required: [],
        },
      },
      path: [1],
      timestamp: 2458.5,
    },
    async reply() {},
  },
  {
    type: "input",
    data: {
      node: {
        id: "input-45dd0a3d",
        type: "input",
        metadata: { visual: { x: 54, y: 193, collapsed: false } },
        configuration: {
          schema: {
            properties: {
              content: {
                type: "object",
                title: "Content",
                examples: [],
                behavior: ["llm-content"],
              },
            },
            type: "object",
            required: [],
          },
        },
      },
      inputArguments: {
        schema: {
          properties: {
            content: {
              type: "object",
              title: "Content",
              examples: [],
              behavior: ["llm-content"],
            },
          },
          type: "object",
          required: [],
        },
      },
      path: [1],
      bubbled: false,
      timestamp: 2467.5,
    },
    async reply() {},
  },
  {
    type: "nodeend",
    data: {
      node: {
        id: "input-45dd0a3d",
        type: "input",
        metadata: { visual: { x: 54, y: 193, collapsed: false } },
        configuration: {
          schema: {
            properties: {
              content: {
                type: "object",
                title: "Content",
                examples: [],
                behavior: ["llm-content"],
              },
            },
            type: "object",
            required: [],
          },
        },
      },
      inputs: {
        schema: {
          properties: {
            content: {
              type: "object",
              title: "Content",
              examples: [],
              behavior: ["llm-content"],
            },
          },
          type: "object",
          required: [],
        },
      },
      outputs: { content: { role: "user", parts: [{ text: "Plain text" }] } },
      path: [1],
      timestamp: 108244.10000002384,
      newOpportunities: [],
    },
    async reply() {},
  },
  {
    type: "nodestart",
    data: {
      node: {
        id: "output-b8d7ce06",
        type: "output",
        metadata: { visual: { x: 340, y: 169, collapsed: false } },
        configuration: {
          schema: {
            properties: {
              content: {
                type: "object",
                title: "Content",
                examples: [],
                behavior: ["llm-content"],
              },
            },
            type: "object",
            required: [],
          },
        },
      },
      inputs: {
        schema: {
          properties: {
            content: {
              type: "object",
              title: "Content",
              examples: [],
              behavior: ["llm-content"],
            },
          },
          type: "object",
          required: [],
        },
        content: { role: "user", parts: [{ text: "Plain text" }] },
      },
      path: [2],
      timestamp: 108251.40000003576,
    },
    async reply() {},
  },
  {
    type: "output",
    data: {
      node: {
        id: "output-b8d7ce06",
        type: "output",
        metadata: { visual: { x: 340, y: 169, collapsed: false } },
        configuration: {
          schema: {
            properties: {
              content: {
                type: "object",
                title: "Content",
                examples: [],
                behavior: ["llm-content"],
              },
            },
            type: "object",
            required: [],
          },
        },
      },
      outputs: { content: { role: "user", parts: [{ text: "Plain text" }] } },
      path: [2],
      timestamp: 108257.90000003576,
      bubbled: false,
    },
    async reply() {},
  },
  {
    type: "nodeend",
    data: {
      node: {
        id: "output-b8d7ce06",
        type: "output",
        metadata: { visual: { x: 340, y: 169, collapsed: false } },
        configuration: {
          schema: {
            properties: {
              content: {
                type: "object",
                title: "Content",
                examples: [],
                behavior: ["llm-content"],
              },
            },
            type: "object",
            required: [],
          },
        },
      },
      inputs: {
        schema: {
          properties: {
            content: {
              type: "object",
              title: "Content",
              examples: [],
              behavior: ["llm-content"],
            },
          },
          type: "object",
          required: [],
        },
        content: { role: "user", parts: [{ text: "Plain text" }] },
      },
      path: [2],
      timestamp: 108272,
      outputs: {},
      newOpportunities: [],
    },
    async reply() {},
  },
  {
    type: "graphend",
    data: { path: [], timestamp: 108274.70000004768 },
    async reply() {},
  },
];
