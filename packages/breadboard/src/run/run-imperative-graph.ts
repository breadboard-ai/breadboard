/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  ImperativeGraph,
  ModuleIdentifier,
  ModuleLanguage,
} from "@breadboard-ai/types";

export {
  isImperativeGraph,
  toDeclarativeGraph,
  toImperativeGraph,
  blankImperative,
  defaultModuleContent,
};

function defaultModuleContent(language: ModuleLanguage = "javascript") {
  return `/**
 * @fileoverview Add a description for your module here.
 */

export { invoke as default, describe };

async function invoke({ context }${language === "typescript" ? ": { context: LLMContent[] }" : ""}) {
  return { context };
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
        },
      },
    } satisfies Schema,
  };
}
`;
}

function blankImperative(): GraphDescriptor {
  return {
    title: "Blank module-backed board",
    description:
      "A blank board. Use it as a starting point for your creations.",
    version: "0.0.1",
    main: "main",
    modules: {
      main: {
        code: "",
        metadata: {
          description: "",
          url: "main.js",
          source: {
            code: defaultModuleContent("typescript"),
            language: "typescript",
          },
          runnable: true,
        },
      },
    },
  } as unknown as GraphDescriptor;
}

function isImperativeGraph(graph: unknown): graph is ImperativeGraph {
  return "main" in (graph as ImperativeGraph);
}
function toDeclarativeGraph(graph: ImperativeGraph): GraphDescriptor {
  const { main } = graph;
  const declarative = structuredClone(graph) as GraphDescriptor;
  declarative.nodes = [
    {
      id: "input",
      type: "input",
      metadata: {
        title: "Input",
      },
    },
    {
      id: "run-module",
      type: "runModule",
      configuration: {
        $module: main,
      },
      metadata: {
        title: `Run "${graph.title || '"main"'}" module`,
      },
    },
    {
      id: "output",
      type: "output",
      metadata: {
        title: "Output",
      },
    },
  ];
  declarative.edges = [
    {
      from: "input",
      to: "run-module",
      out: "*",
      in: "",
    },
    {
      from: "run-module",
      to: "output",
      out: "*",
      in: "",
    },
  ];
  return declarative;
}

function toImperativeGraph(
  main: ModuleIdentifier,
  graph: GraphDescriptor
): GraphDescriptor {
  const imperative = structuredClone(graph) as Partial<GraphDescriptor>;
  imperative.main = main;
  delete imperative.nodes;
  delete imperative.edges;
  delete imperative.graphs;
  return imperative as GraphDescriptor;
}
