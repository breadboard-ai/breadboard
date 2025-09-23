/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as toolsSearchEvents from "./Search-Events";
import * as toolsSearchHotels from "./Search-Hotels";
import * as toolsSearchJobs from "./Search-Jobs";
import * as toolsSearchMoma from "./Search-Moma";
import * as toolsCodeExecution from "./code-execution";
import * as toolsGetWeather from "./get-weather";
import * as toolsGetWeatherTool from "./get-weather-tool";
import * as toolsGetWebpage from "./get-webpage";
import * as toolsSearchEnterprise from "./search-enterprise";
import * as toolsSearchInternal from "./search-internal";
import * as toolsSearchMaps from "./search-maps";
import * as toolsSearchWeb from "./search-web";
import * as toolsSearchWikipedia from "./search-wikipedia";
import * as toolsSqlQueryInternal from "./sql-query-internal";
import * as toolsToolGetWebpage from "./tool-get-webpage";
import * as toolsToolSearchEnterprise from "./tool-search-enterprise";
import * as toolsToolSearchEvents from "./tool-search-events";
import * as toolsToolSearchHotels from "./tool-search-hotels";
import * as toolsToolSearchInternal from "./tool-search-internal";
import * as toolsToolSearchJobs from "./tool-search-jobs";
import * as toolsToolSearchMaps from "./tool-search-maps";
import * as toolsToolSearchMoma from "./tool-search-moma";
import * as toolsToolSearchWeb from "./tool-search-web";
import * as toolsToolSearchWikipedia from "./tool-search-wikipedia";
import * as toolsToolSqlQueryInternal from "./tool-sql-query-internal";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl";

export const exports = {
  "Search-Events": toolsSearchEvents,
  "Search-Hotels": toolsSearchHotels,
  "Search-Jobs": toolsSearchJobs,
  "Search-Moma": toolsSearchMoma,
  "code-execution": toolsCodeExecution,
  "get-weather-tool": toolsGetWeatherTool,
  "get-weather": toolsGetWeather,
  "get-webpage": toolsGetWebpage,
  "search-enterprise": toolsSearchEnterprise,
  "search-internal": toolsSearchInternal,
  "search-maps": toolsSearchMaps,
  "search-web": toolsSearchWeb,
  "search-wikipedia": toolsSearchWikipedia,
  "sql-query-internal": toolsSqlQueryInternal,
  "tool-get-webpage": toolsToolGetWebpage,
  "tool-search-enterprise": toolsToolSearchEnterprise,
  "tool-search-events": toolsToolSearchEvents,
  "tool-search-hotels": toolsToolSearchHotels,
  "tool-search-internal": toolsToolSearchInternal,
  "tool-search-jobs": toolsToolSearchJobs,
  "tool-search-maps": toolsToolSearchMaps,
  "tool-search-moma": toolsToolSearchMoma,
  "tool-search-web": toolsToolSearchWeb,
  "tool-search-wikipedia": toolsToolSearchWikipedia,
  "tool-sql-query-internal": toolsToolSqlQueryInternal,
};

export const bgl = createBgl(descriptor, exports);
