/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { StaticTool } from "../ui/state/types.js";
import getWeatherInvoke, {
  describe as getWeatherDescribe,
} from "./tools/get-weather.js";
import searchWebInvoke, {
  describe as searchWebDescribe,
} from "./tools/search-web.js";
import getWebpageInvoke, {
  describe as getWebpageDescribe,
} from "./tools/get-webpage.js";
import searchMapsInvoke, {
  describe as searchMapsDescribe,
} from "./tools/search-maps.js";
import searchInternalInvoke, {
  describe as searchInternalDescribe,
} from "./tools/search-internal.js";
import searchEnterpriseInvoke, {
  describe as searchEnterpriseDescribe,
} from "./tools/search-enterprise.js";
import codeExecutionInvoke, {
  describe as codeExecutionDescribe,
} from "./tools/code-execution.js";
import userInputInvoke, {
  describe as userInputDescribe,
} from "./a2/user-input.js";
import renderOutputsInvoke, {
  describe as renderOutputsDescribe,
} from "./a2/render-outputs.js";
import generateInvoke, {
  describe as generateDescribe,
} from "./generate/main.js";

export { A2_COMPONENTS, A2_TOOLS };

const BASE_URL = "embed://a2/tools.bgl.json";

/**
 * Static registry of A2 tools that appear in the fast access menu.
 * These are the tools exported from a2/tools/index.ts.
 * Environment-specific tools include tags that are filtered at runtime
 * by fast-access-menu based on globalConfig.environmentName.
 */
const A2_TOOLS: [string, StaticTool][] = [
  [
    `${BASE_URL}#module:get-weather`,
    {
      url: `${BASE_URL}#module:get-weather`,
      title: "Get Weather",
      description: "Get weather information for a location",
      icon: "sunny",
      invoke: getWeatherInvoke,
      describe: getWeatherDescribe,
    },
  ],
  [
    `${BASE_URL}#module:search-web`,
    {
      url: `${BASE_URL}#module:search-web`,
      title: "Search Web",
      description: "Search the web for information",
      icon: "search",
      invoke: searchWebInvoke,
      describe: searchWebDescribe,
    },
  ],
  [
    `${BASE_URL}#module:get-webpage`,
    {
      url: `${BASE_URL}#module:get-webpage`,
      title: "Get Webpage",
      description: "Retrieve content from a webpage",
      icon: "language",
      invoke: getWebpageInvoke,
      describe: getWebpageDescribe,
    },
  ],
  [
    `${BASE_URL}#module:search-maps`,
    {
      url: `${BASE_URL}#module:search-maps`,
      title: "Search Maps",
      description: "Search Google Maps for places",
      icon: "map_search",
      invoke: searchMapsInvoke,
      describe: searchMapsDescribe,
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
      invoke: searchInternalInvoke,
      describe: searchInternalDescribe,
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
      invoke: searchEnterpriseInvoke,
      describe: searchEnterpriseDescribe,
    },
  ],
  [
    `${BASE_URL}#module:code-execution`,
    {
      url: `${BASE_URL}#module:code-execution`,
      title: "Code Execution",
      description: "Execute code snippets",
      icon: "code",
      invoke: codeExecutionInvoke,
      describe: codeExecutionDescribe,
    },
  ],
];

/**
 * Static registry of A2 components that appear in the component picker.
 * These are the step types available in the editor controls.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentInvoke = (...args: any[]) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentDescribe = (...args: any[]) => Promise<any>;

type A2Component = {
  url: string;
  title: string;
  description: string;
  icon: string;
  order: number;
  category: "input" | "generate" | "output";
  invoke: ComponentInvoke;
  describe: ComponentDescribe;
  /**
   * Optional module URL alias. If present, requests for this component's URL
   * should be redirected to this module URL for proper context wiring.
   */
  moduleUrl?: string;
};

const A2_COMPONENTS: A2Component[] = [
  {
    url: "embed://a2/a2.bgl.json#21ee02e7-83fa-49d0-964c-0cab10eafc2c",
    moduleUrl: "embed://a2/a2.bgl.json#module:user-input",
    title: "User Input",
    description:
      "Allows asking user for input that could be then used in next steps",
    icon: "ask-user",
    order: 1,
    category: "input",
    invoke: userInputInvoke,
    describe: userInputDescribe,
  },
  {
    url: "embed://a2/generate.bgl.json#module:main",
    title: "Generate",
    description: "Uses Gemini to generate content and call tools",
    icon: "generative",
    order: 1,
    category: "generate",
    invoke: generateInvoke,
    describe: generateDescribe,
  },
  {
    url: "embed://a2/a2.bgl.json#module:render-outputs",
    title: "Output",
    description: "Renders multiple outputs into single display",
    icon: "responsive_layout",
    order: 100,
    category: "output",
    invoke: renderOutputsInvoke,
    describe: renderOutputsDescribe,
  },
];
