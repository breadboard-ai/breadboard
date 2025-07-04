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
      timestamp: 2156.099999964237,
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
      timestamp: 2167.2999999523163,
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
      timestamp: 2172.899999976158,
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
      outputs: {
        content: {
          role: "user",
          parts: [
            {
              inlineData: {
                data: "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",
                mimeType: "image/png",
              },
            },
          ],
        },
      },
      path: [1],
      timestamp: 16784.899999976158,
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
        content: {
          role: "user",
          parts: [
            {
              inlineData: {
                data: "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",
                mimeType: "image/png",
              },
            },
          ],
        },
      },
      path: [2],
      timestamp: 16792.099999964237,
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
      outputs: {
        content: {
          role: "user",
          parts: [
            {
              inlineData: {
                data: "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",
                mimeType: "image/png",
              },
            },
          ],
        },
      },
      path: [2],
      timestamp: 16797.5,
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
        content: {
          role: "user",
          parts: [
            {
              inlineData: {
                data: "iVBORw0KGgoAAAANSUhEUgAAAPQAAAC3CAYAAAAl43M8AAAAAXNSR0IArs4c6QAACb1JREFUeF7t3buO1EwTgOGGRURIcAEEcAecxSkjJOAQEBBwA0gQkAESISIn5wKAjBCEkBDitAtCIiQDcQmc2U+9+md/M8ww9tgu7/Y+lhBasLtcb9U77mnveDYtLy8vJxsCCBRBYBOhi6ijJBBYIUBojYBAQQQIXVAxpYIAofUAAgURIHRBxZQKAoTWAwgURIDQBRVTKggQWg8gUBABQhdUTKkgQGg9gEBBBAhdUDGlggCh9QACBREgdEHFlAoChNYDCBREgNAFFVMqCBBaDyBQEAFCF1RMqSBAaD2AQEEECF1QMaWCAKH1AAIFESB0QcWUCgKE1gMIFESA0AUVUyoIEFoPIFAQAUIXVEypIEBoPYBAQQQIXVAxpYIAofUAAgURIHRBxZQKAoTWAwgURIDQBRVTKggQWg8gUBABQhdUTKkgQGg9gEBBBAhdUDGlggCh9QACBREgdEHFlAoChNYDCBREgNAFFVMqCBBaDyBQEAFCF1RMqSBAaD2AQEEECF1QMaWCAKH1AAIFESB0QcWUCgKE1gMIFESA0AUVUyoIEFoPIFAQAUIXVEypIEBoPYBAQQQIXVAxpYIAofUAAgURIHRBxZQKAoTWAwgURIDQBRVTKggQWg8gUBABQhdUTKkgQGg9gEBBBAhdUDGlggCh9QACBREgdEHFlAoChNYDCBREgNAFFVMqCBBaDyBQEAFCF1RMqSBAaD2AQEEECF1QMaWCAKH1AAIFESB0QcWUCgKE1gMIFESA0AUVUyoIEFoPIFAQAUIXVMxpqezbty9t3rw5LS8vr+yS/379+vXKv9nKIkDoNVDP27dvpzt37qzKloV78+ZNJ2c2knnSYNu3b0+PHj3qJI5B1gYBQq+BOuzfvz9t2rTpjzPJUi8uLrY+u38J/fv377S0tNQ6hgHWDgFCD1yLAwcOTDyDLmTLMucXitGLxWjKXf25ixeNgREKXyFA6IHbYZrQXVyhx6/8CwsL6efPn3/MBvJ7aVs5BAg9cC0nTbfzKXVxhZ42djVlQg/cAB2HJ3THQJsON+0KvWvXrnTv3r2mw/2x//iUu/qfXcwAWp2cg3shQOhesNYf9PDhwyvT4NGWRct/ulqs2rt378rtqeqiWx7/x48f6d27d/VP1J7rggChBy7T58+f08mTJ1cXr379+tXZLauBUxN+AAKEHgC6kAj0RYDQfZE1LgIDECD0ANCFRKAvAoTui6xxERiAAKEHgC4kAn0RIHRfZI2LwAAECD0AdCER6IsAofsia1wEBiBA6AGgC4lAXwQI3RdZ4yIwAAFCDwBdSAT6IkDoGWTPnTuXPnz4sLJX/j3rt2/f9lUL4yLQmgChZyCsPsLHRw5b95sBeiZA6BmAqw8JIHTP3Wj41gQI7QrduomaDPDx48e0c+fOJofYtwEBQhO6Qbu02/XKlSvpyZMnaevWrenZs2ftBnP0RAKEbiB03tUzuOY3qfq4pevXr6fTp0/PP5gjCT1PD1gUm4fa5GOq6xH50Uv5CwZs3RJwhbYo1m1H/WO0qtC7d+9Od+/eDYu9UQIRmtBhvV6dcp85cyZdu3YtLPZGCUToGZW+ceNGevDgwepTMz3Ebz41Tp06lT59+rR6sLWI+TjOOorQswillNyLrgHJTKc9pA5GIHQNiONCnz9/PuVbMLb6BKrTbb+gU59b0z0JXZNYVeouvqamZthidqvyyw/9f/XqVTG5raVECF2zGuPfE3Xp0qV04cKFmkdv7N2OHDmy8k0do+3s2bPp6tWrGxtKT9kTuibY8a+UcZWuCS6ldPDgwZWv9xltFsTqs2u6J6EbEBu/Slvxrgdv/Av5CF2P2zx7EboBtZs3b6b79++vHmFxpx48C2L1OHWxF6EbUqz+KqgpZD14VaG9VanHbN69CD0HufGpd/661pcvX84x0sY4pMprx44d6eHDhxsj8QGyJPQc0MeFNvWeDtGC2BwN1uIQQs8Jb3yhxwLZZJAWxOZssDkPI/Sc4PJhpt6z4VkQm82oyz0I3YJmvje9sLDwxwi3bt1KJ06caDFqWYe6QsfWk9AteY83bB7Ofdb/Q3WFbtlgDQ8ndENgk3Yfv5Xl1sxkob3QddBsM4YgdEeMx99Pu1L/vcZA6I6a7R/DELojxk+fPk2XL19efRBCHnaj385yy6qj5mowDKEbwJq16/Pnz9PFixdJ/T9QFsRmdUz3/0/ojpnu2bMnbdmy5a9RN+J004JYx81VYzhC14DUdJc81cwLY/mD/KMtT7+/fv2a3r9/33S4dbf/0aNH07dv3/7IfyO+oA1ROEL3RH3SPeosdb56v3jxoqeoww977NixlReu6ouZJ5TE1YXQPbL+/v17ylerSduXL1+Ku1ofP3485bzGZyaLi4s9UjZ0lQChA/ph0i2t0RM8Smn2SR8r3eir/AGt9VcIQgdRP3To0Mr76vEtN33++OV6fmhefsHKW/XKnH/2vjmouSphCB3MPK/8ZonHm38kxHoTe9rso5SZR3B7tA5H6NYImw8wWjiadFUbyb4erm7jvzgyIrEezr151dbHEYQeuE6TrnD5lEbvsdfiqvgkkUt46zBwK3QSntCdYGw3yKT71tUR18pVO68D5Ac5jM8s8vnlP0tLS+1AOLo1AUK3RtjtANOmseNRou7tTptBVM/HFLvbHmgzGqHb0Ovx2Gkrx9NCVh9kP2nBrY9TdVuqD6rtxiR0O369Hz263TUSNkrWSYmNpv75HLZt25YeP37ce/4CNCNA6Ga8Bt+7zhS4r5PMC3T5E2W2tUuA0Gu3No3ObPTeuzr1bjTAlJ3z1dh75C5IxoxB6BjOoiAQQoDQIZgFQSCGAKFjOIuCQAgBQodgFgSBGAKEjuEsCgIhBAgdglkQBGIIEDqGsygIhBAgdAhmQRCIIUDoGM6iIBBCgNAhmAVBIIYAoWM4i4JACAFCh2AWBIEYAoSO4SwKAiEECB2CWRAEYggQOoazKAiEECB0CGZBEIghQOgYzqIgEEKA0CGYBUEghgChYziLgkAIAUKHYBYEgRgChI7hLAoCIQQIHYJZEARiCBA6hrMoCIQQIHQIZkEQiCFA6BjOoiAQQoDQIZgFQSCGAKFjOIuCQAgBQodgFgSBGAKEjuEsCgIhBAgdglkQBGIIEDqGsygIhBAgdAhmQRCIIUDoGM6iIBBCgNAhmAVBIIYAoWM4i4JACAFCh2AWBIEYAoSO4SwKAiEECB2CWRAEYggQOoazKAiEECB0CGZBEIghQOgYzqIgEEKA0CGYBUEghgChYziLgkAIAUKHYBYEgRgChI7hLAoCIQQIHYJZEARiCBA6hrMoCIQQ+A+sTBEnEQXhEgAAAABJRU5ErkJggg==",
                mimeType: "image/png",
              },
            },
          ],
        },
      },
      path: [2],
      timestamp: 16803.69999998808,
      outputs: {},
      newOpportunities: [],
    },
    async reply() {},
  },
  { type: "graphend", data: { path: [], timestamp: 16807 }, async reply() {} },
];
