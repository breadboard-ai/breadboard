/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Tool } from "../ui/types/state-types.js";

// Tool module imports
import * as toolsGetWeather from "./tools/get-weather.js";
import * as toolsSearchWeb from "./tools/search-web.js";
import * as toolsGetWebpage from "./tools/get-webpage.js";
import * as toolsSearchMaps from "./tools/search-maps.js";
import * as toolsSearchInternal from "./tools/search-internal.js";
import * as toolsSearchEnterprise from "./tools/search-enterprise.js";
import * as toolsCodeExecution from "./tools/code-execution.js";

// Component module imports
import * as askUserMain from "./ask-user/main.js";
import * as generateMain from "./generate/main.js";
import * as renderOutputs from "./a2/render-outputs.js";

export { A2_COMPONENTS, A2_TOOLS, A2_TOOL_MAP, A2_COMPONENT_MAP };
export type { A2Component };

/**
 * Generic function types for describe and invoke methods.
 * Each module has its own specific input/output types, so we use a generic
 * function signature here that matches the pattern in runnable-module-factory.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DescribeFunction = (...args: any[]) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvokeFunction = (...args: any[]) => Promise<any>;

type A2Tool = Tool & {
  describe: DescribeFunction;
  invoke: InvokeFunction;
};

const BASE_URL = "embed://a2/tools.bgl.json";

/**
 * Static registry of A2 tools that appear in the fast access menu.
 * These are the tools exported from a2/tools/index.ts.
 * Environment-specific tools include tags that are filtered at runtime
 * by fast-access-menu based on globalConfig.environmentName.
 */
const A2_TOOLS: [string, A2Tool][] = [
  [
    `${BASE_URL}#module:get-weather`,
    {
      url: `${BASE_URL}#module:get-weather`,
      title: "Get Weather",
      description: "Get weather information for a location",
      icon: "sunny",
      describe: toolsGetWeather.describe,
      invoke: toolsGetWeather.default,
    },
  ],
  [
    `${BASE_URL}#module:search-web`,
    {
      url: `${BASE_URL}#module:search-web`,
      title: "Search Web",
      description: "Search the web for information",
      icon: "search",
      describe: toolsSearchWeb.describe,
      invoke: toolsSearchWeb.default,
    },
  ],
  [
    `${BASE_URL}#module:get-webpage`,
    {
      url: `${BASE_URL}#module:get-webpage`,
      title: "Get Webpage",
      description: "Retrieve content from a webpage",
      icon: "language",
      describe: toolsGetWebpage.describe,
      invoke: toolsGetWebpage.default,
    },
  ],
  [
    `${BASE_URL}#module:search-maps`,
    {
      url: `${BASE_URL}#module:search-maps`,
      title: "Search Maps",
      description: "Search Google Maps for places",
      icon: "map_search",
      describe: toolsSearchMaps.describe,
      invoke: toolsSearchMaps.default,
    },
  ],
  [
    `${BASE_URL}#module:search-internal`,
    {
      url: `${BASE_URL}#module:search-internal`,
      title: "Search Internal",
      description: "Search internal knowledge base",
      icon: "search",
      tags: ["environment-corp"],
      describe: toolsSearchInternal.describe,
      invoke: toolsSearchInternal.default,
    },
  ],
  [
    `${BASE_URL}#module:search-enterprise`,
    {
      url: `${BASE_URL}#module:search-enterprise`,
      title: "Search Enterprise",
      description: "Search enterprise knowledge base",
      icon: "search",
      tags: ["environment-agentspace"],
      describe: toolsSearchEnterprise.describe,
      invoke: toolsSearchEnterprise.default,
    },
  ],
  [
    `${BASE_URL}#module:code-execution`,
    {
      url: `${BASE_URL}#module:code-execution`,
      title: "Code Execution",
      description: "Execute code snippets",
      icon: "code",
      describe: toolsCodeExecution.describe,
      invoke: toolsCodeExecution.default,
    },
  ],
];

/**
 * Map of tool URLs to A2Tool objects for efficient lookup.
 */
const A2_TOOL_MAP: ReadonlyMap<string, A2Tool> = new Map(A2_TOOLS);

/**
 * Static registry of A2 components that appear in the component picker.
 * These are the step types available in the editor controls.
 */
type A2Component = {
  url: string;
  title: string;
  description: string;
  icon: string;
  order: number;
  category: "input" | "generate" | "output";
  /**
   * If set, this module URL will be used instead of graph-based execution.
   * This allows short-circuiting the graph dispatch and calling the module directly.
   */
  moduleUrl?: string;
  describe: DescribeFunction;
  invoke: InvokeFunction;
};

const A2_COMPONENTS: A2Component[] = [
  {
    url: "embed://a2/a2.bgl.json#21ee02e7-83fa-49d0-964c-0cab10eafc2c",
    title: "User Input",
    description:
      "Allows asking user for input that could be then used in next steps",
    icon: "ask-user",
    order: 1,
    category: "input",
    moduleUrl: "embed://a2/ask-user.bgl.json#module:main",
    describe: askUserMain.describe,
    invoke: askUserMain.default,
  },
  {
    url: "embed://a2/generate.bgl.json#module:main",
    title: "Generate",
    description: "Uses Gemini to generate content and call tools",
    icon: "generative",
    order: 1,
    category: "generate",
    describe: generateMain.describe,
    invoke: generateMain.default,
  },
  {
    url: "embed://a2/a2.bgl.json#module:render-outputs",
    title: "Output",
    description: "Renders multiple outputs into single display",
    icon: "responsive_layout",
    order: 100,
    category: "output",
    describe: renderOutputs.describe,
    invoke: renderOutputs.default,
  },
];

/**
 * Map of component URLs to A2Component objects for efficient lookup.
 * Maps both the component URL and moduleUrl (if present) to the same component.
 */
const A2_COMPONENT_MAP: ReadonlyMap<string, A2Component> = new Map(
  A2_COMPONENTS.flatMap((c) => {
    const entries: [string, A2Component][] = [[c.url, c]];
    if (c.moduleUrl) entries.push([c.moduleUrl, c]);
    return entries;
  })
);
