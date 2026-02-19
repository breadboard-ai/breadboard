/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as toolsCodeExecution from "./code-execution.js";
import * as toolsGetWeather from "./get-weather.js";
import * as toolsGetWebpage from "./get-webpage.js";
import * as toolsSearchEnterprise from "./search-enterprise.js";
import * as toolsSearchInternal from "./search-internal.js";
import * as toolsSearchMaps from "./search-maps.js";
import * as toolsSearchWeb from "./search-web.js";

export const exports = {
  "code-execution": toolsCodeExecution,
  "get-weather": toolsGetWeather,
  "get-webpage": toolsGetWebpage,
  "search-enterprise": toolsSearchEnterprise,
  "search-internal": toolsSearchInternal,
  "search-maps": toolsSearchMaps,
  "search-web": toolsSearchWeb,
};
