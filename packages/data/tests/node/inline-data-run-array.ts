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
        title: "Blank board",
        description:
          "A blank board. Use it as a starting point for your creations.",
        version: "0.0.1",
        nodes: [
          {
            type: "input",
            id: "input",
            configuration: {
              schema: {
                properties: {
                  context: {
                    type: "array",
                    title: "Context",
                    examples: [],
                    items: {
                      type: "object",
                      behavior: ["llm-content"],
                    },
                    default: '[{"role":"user","parts":[{"text":""}]}]',
                  },
                },
                type: "object",
                required: [],
              },
            },
            metadata: {
              visual: {
                x: 0,
                y: 0,
                collapsed: true,
              },
            },
          },
          {
            type: "output",
            id: "output",
            configuration: {
              schema: {
                properties: {
                  context: {
                    type: "array",
                    title: "Context",
                    examples: [],
                    items: {
                      type: "object",
                      behavior: ["llm-content"],
                    },
                    default: "null",
                  },
                },
                type: "object",
                required: [],
              },
            },
            metadata: {
              visual: {
                x: 173,
                y: 0,
                collapsed: true,
              },
            },
          },
        ],
        edges: [
          {
            from: "input",
            out: "context",
            to: "output",
            in: "context",
          },
        ],
        url: "idb://default/blank-board.bgl.json",
      },
      graphId: "",
      path: [],
      timestamp: 68300.29999999702,
    },
    async reply() {},
  },
  {
    type: "nodestart",
    data: {
      node: {
        type: "input",
        id: "input",
        configuration: {
          schema: {
            properties: {
              context: {
                type: "array",
                title: "Context",
                examples: [],
                items: {
                  type: "object",
                  behavior: ["llm-content"],
                },
                default: '[{"role":"user","parts":[{"text":""}]}]',
              },
            },
            type: "object",
            required: [],
          },
        },
        metadata: {
          visual: {
            x: 0,
            y: 0,
            collapsed: true,
          },
        },
      },
      inputs: {
        schema: {
          properties: {
            context: {
              type: "array",
              title: "Context",
              examples: [],
              items: {
                type: "object",
                behavior: ["llm-content"],
              },
              default: '[{"role":"user","parts":[{"text":""}]}]',
            },
          },
          type: "object",
          required: [],
        },
      },
      path: [1],
      timestamp: 68356.60000000149,
    },
    async reply() {},
  },
  {
    type: "input",
    data: {
      node: {
        type: "input",
        id: "input",
        configuration: {
          schema: {
            properties: {
              context: {
                type: "array",
                title: "Context",
                examples: [],
                items: {
                  type: "object",
                  behavior: ["llm-content"],
                },
                default: '[{"role":"user","parts":[{"text":""}]}]',
              },
            },
            type: "object",
            required: [],
          },
        },
        metadata: {
          visual: {
            x: 0,
            y: 0,
            collapsed: true,
          },
        },
      },
      inputArguments: {
        schema: {
          properties: {
            context: {
              type: "array",
              title: "Context",
              examples: [],
              items: {
                type: "object",
                behavior: ["llm-content"],
              },
              default: '[{"role":"user","parts":[{"text":""}]}]',
            },
          },
          type: "object",
          required: [],
        },
      },
      path: [1],
      bubbled: false,
      timestamp: 68364.20000000298,
    },
    async reply() {},
  },
  {
    type: "nodeend",
    data: {
      node: {
        type: "input",
        id: "input",
        configuration: {
          schema: {
            properties: {
              context: {
                type: "array",
                title: "Context",
                examples: [],
                items: {
                  type: "object",
                  behavior: ["llm-content"],
                },
                default: '[{"role":"user","parts":[{"text":""}]}]',
              },
            },
            type: "object",
            required: [],
          },
        },
        metadata: {
          visual: {
            x: 0,
            y: 0,
            collapsed: true,
          },
        },
      },
      inputs: {
        schema: {
          properties: {
            context: {
              type: "array",
              title: "Context",
              examples: [],
              items: {
                type: "object",
                behavior: ["llm-content"],
              },
              default: '[{"role":"user","parts":[{"text":""}]}]',
            },
          },
          type: "object",
          required: [],
        },
      },
      outputs: {
        context: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: "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",
                },
              },
            ],
          },
        ],
      },
      path: [1],
      timestamp: 70183.20000000298,
      newOpportunities: [],
    },
    async reply() {},
  },
  {
    type: "nodestart",
    data: {
      node: {
        type: "output",
        id: "output",
        configuration: {
          schema: {
            properties: {
              context: {
                type: "array",
                title: "Context",
                examples: [],
                items: {
                  type: "object",
                  behavior: ["llm-content"],
                },
                default: "null",
              },
            },
            type: "object",
            required: [],
          },
        },
        metadata: {
          visual: {
            x: 173,
            y: 0,
            collapsed: true,
          },
        },
      },
      inputs: {
        schema: {
          properties: {
            context: {
              type: "array",
              title: "Context",
              examples: [],
              items: {
                type: "object",
                behavior: ["llm-content"],
              },
              default: "null",
            },
          },
          type: "object",
          required: [],
        },
        context: [
          {
            role: "user",
            parts: [
              {
                storedData: {
                  handle:
                    "blob:http://localhost:5173/f28de4b7-0ace-4d76-912e-70ee79048053",
                  mimeType: "image/png",
                },
              },
            ],
          },
        ],
      },
      path: [2],
      timestamp: 70193.29999999702,
    },
    async reply() {},
  },
  {
    type: "output",
    data: {
      node: {
        type: "output",
        id: "output",
        configuration: {
          schema: {
            properties: {
              context: {
                type: "array",
                title: "Context",
                examples: [],
                items: {
                  type: "object",
                  behavior: ["llm-content"],
                },
                default: "null",
              },
            },
            type: "object",
            required: [],
          },
        },
        metadata: {
          visual: {
            x: 173,
            y: 0,
            collapsed: true,
          },
        },
      },
      outputs: {
        context: [
          {
            role: "user",
            parts: [
              {
                storedData: {
                  handle:
                    "blob:http://localhost:5173/f28de4b7-0ace-4d76-912e-70ee79048053",
                  mimeType: "image/png",
                },
              },
            ],
          },
        ],
      },
      path: [2],
      timestamp: 70203.60000000149,
      bubbled: false,
    },
    async reply() {},
  },
  {
    type: "nodeend",
    data: {
      node: {
        type: "output",
        id: "output",
        configuration: {
          schema: {
            properties: {
              context: {
                type: "array",
                title: "Context",
                examples: [],
                items: {
                  type: "object",
                  behavior: ["llm-content"],
                },
                default: "null",
              },
            },
            type: "object",
            required: [],
          },
        },
        metadata: {
          visual: {
            x: 173,
            y: 0,
            collapsed: true,
          },
        },
      },
      inputs: {
        schema: {
          properties: {
            context: {
              type: "array",
              title: "Context",
              examples: [],
              items: {
                type: "object",
                behavior: ["llm-content"],
              },
              default: "null",
            },
          },
          type: "object",
          required: [],
        },
        context: [
          {
            role: "user",
            parts: [
              {
                storedData: {
                  handle:
                    "blob:http://localhost:5173/f28de4b7-0ace-4d76-912e-70ee79048053",
                  mimeType: "image/png",
                },
              },
            ],
          },
        ],
      },
      outputs: {},
      path: [2],
      timestamp: 70207.89999999851,
      newOpportunities: [],
    },
    async reply() {},
  },
  {
    type: "graphend",
    data: {
      path: [],
      timestamp: 70210.39999999851,
    },
    async reply() {},
  },
  {
    type: "end",
    data: {
      timestamp: 70213.20000000298,
      last: {
        node: {
          type: "output",
          id: "output",
          configuration: {
            schema: {
              properties: {
                context: {
                  type: "array",
                  title: "Context",
                  examples: [],
                  items: {
                    type: "object",
                    behavior: ["llm-content"],
                  },
                  default: "null",
                },
              },
              type: "object",
              required: [],
            },
          },
          metadata: {
            visual: {
              x: 173,
              y: 0,
              collapsed: true,
            },
          },
        },
        missing: [],
      },
    },
    async reply() {},
  },
];
