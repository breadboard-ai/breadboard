/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Tool } from "../ui/state/types.js";

export { A2_COMPONENTS, A2_TOOLS };

const BASE_URL = "embed://a2/tools.bgl.json";

/**
 * Static registry of A2 tools that appear in the fast access menu.
 * These are the tools exported from a2/tools/index.ts.
 * Environment-specific tools include tags that are filtered at runtime
 * by fast-access-menu based on globalConfig.environmentName.
 */
const A2_TOOLS: [string, Tool][] = [
  [
    `${BASE_URL}#module:get-weather`,
    {
      url: `${BASE_URL}#module:get-weather`,
      title: "Get Weather",
      description: "Get weather information for a location",
      icon: "sunny",
    },
  ],
  [
    `${BASE_URL}#module:search-web`,
    {
      url: `${BASE_URL}#module:search-web`,
      title: "Search Web",
      description: "Search the web for information",
      icon: "search",
    },
  ],
  [
    `${BASE_URL}#module:get-webpage`,
    {
      url: `${BASE_URL}#module:get-webpage`,
      title: "Get Webpage",
      description: "Retrieve content from a webpage",
      icon: "language",
    },
  ],
  [
    `${BASE_URL}#module:search-maps`,
    {
      url: `${BASE_URL}#module:search-maps`,
      title: "Search Maps",
      description: "Search Google Maps for places",
      icon: "map_search",
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
    },
  ],
  [
    `${BASE_URL}#module:code-execution`,
    {
      url: `${BASE_URL}#module:code-execution`,
      title: "Code Execution",
      description: "Execute code snippets",
      icon: "code",
    },
  ],
];

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
  },
  {
    url: "embed://a2/generate.bgl.json#module:main",
    title: "Generate",
    description: "Uses Gemini to generate content and call tools",
    icon: "generative",
    order: 1,
    category: "generate",
  },
  {
    url: "embed://a2/a2.bgl.json#module:render-outputs",
    title: "Output",
    description: "Renders multiple outputs into single display",
    icon: "responsive_layout",
    order: 100,
    category: "output",
  },
];
