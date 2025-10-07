/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as toolsSearchMoma from "./Search-Moma";
import * as toolsCodeExecution from "./code-execution";
import * as toolsGetWeather from "./get-weather";
import * as toolsGetWebpage from "./get-webpage";
import * as toolsSearchEnterprise from "./search-enterprise";
import * as toolsSearchInternal from "./search-internal";
import * as toolsSearchMaps from "./search-maps";
import * as toolsSearchWeb from "./search-web";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl";

export const exports = {
  "Search-Moma": toolsSearchMoma,
  "code-execution": toolsCodeExecution,
  "get-weather": toolsGetWeather,
  "get-webpage": toolsGetWebpage,
  "search-enterprise": toolsSearchEnterprise,
  "search-internal": toolsSearchInternal,
  "search-maps": toolsSearchMaps,
  "search-web": toolsSearchWeb,
};

export const bgl = createBgl(descriptor, exports);
