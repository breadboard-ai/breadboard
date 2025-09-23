/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as folioConfigurator from "./folio/configurator";
import * as folioLoadAll from "./folio/load-all";
import * as folioSaveState from "./folio/save-state";
import * as a2AudioGenerator from "./a2/audio-generator";
import * as a2CombineOutputs from "./a2/combine-outputs";
import * as a2Common from "./a2/common";
import * as a2ConnectorManager from "./a2/connector-manager";
import * as a2Entry from "./a2/entry";
import * as a2ForEach from "./a2/for-each";
import * as a2GeminiPrompt from "./a2/gemini-prompt";
import * as a2Gemini from "./a2/gemini";
import * as a2HtmlGenerator from "./a2/html-generator";
import * as a2ImageEditor from "./a2/image-editor";
import * as a2ImageGenerator from "./a2/image-generator";
import * as a2ImageUtils from "./a2/image-utils";
import * as a2Introducer from "./a2/introducer";
import * as a2Lists from "./a2/lists";
import * as a2MakeCode from "./a2/make-code";
import * as a2Output from "./a2/output";
import * as a2RenderOutputs from "./a2/render-outputs";
import * as a2Researcher from "./a2/researcher";
import * as a2Rpc from "./a2/rpc";
import * as a2Settings from "./a2/settings";
import * as a2StepExecutor from "./a2/step-executor";
import * as a2Template from "./a2/template";
import * as a2TextEntry from "./a2/text-entry";
import * as a2TextMain from "./a2/text-main";
import * as a2ToolManager from "./a2/tool-manager";
import * as a2Utils from "./a2/utils";
import * as audioGeneratorMain from "./audio-generator/main";
import * as fileSystemConfigurator from "./file-system/configurator";
import * as fileSystemConnectorLoad from "./file-system/connector-load";
import * as fileSystemConnectorSave from "./file-system/connector-save";
import * as fileSystemTypes from "./file-system/types";
import * as generateMain from "./generate/main";
import * as gmailConfigurator from "./gmail/configurator";
import * as gmailGetEmails from "./gmail/get-emails";
import * as generateTextChatTools from "./generate-text/chat-tools";
import * as generateTextEntry from "./generate-text/entry";
import * as generateTextJoin from "./generate-text/join";
import * as generateTextMain from "./generate-text/main";
import * as generateTextSystemInstructionTs from "./generate-text/system-instruction-ts";
import * as generateTextSystemInstruction from "./generate-text/system-instruction";
import * as generateTextTypes from "./generate-text/types";
import * as goOverListConversationalPlannerPrompt from "./go-over-list/conversational-planner-prompt";
import * as goOverListConversationalThinkStrategist from "./go-over-list/conversational-think-strategist";
import * as goOverListMain from "./go-over-list/main";
import * as goOverListOrganizerPrompt from "./go-over-list/organizer-prompt";
import * as goOverListParallelStrategist from "./go-over-list/parallel-strategist";
import * as goOverListPlannerPrompt from "./go-over-list/planner-prompt";
import * as goOverListRuntime from "./go-over-list/runtime";
import * as goOverListSequentialStrategist from "./go-over-list/sequential-strategist";
import * as goOverListSystemInstruction from "./go-over-list/system-instruction";
import * as goOverListThinkStrategist from "./go-over-list/think-strategist";
import * as goOverListTypes from "./go-over-list/types";
import * as googleDriveApi from "./google-drive/api";
import * as googleDriveConfigurator from "./google-drive/configurator";
import * as googleDriveConnectorLoad from "./google-drive/connector-load";
import * as googleDriveConnectorSave from "./google-drive/connector-save";
import * as googleDriveDocs from "./google-drive/docs";
import * as googleDriveMarkedTypes from "./google-drive/marked-types";
import * as googleDriveMarked from "./google-drive/marked";
import * as googleDriveSheets from "./google-drive/sheets";
import * as googleDriveSlidesSchema from "./google-drive/slides-schema";
import * as googleDriveSlides from "./google-drive/slides";
import * as googleDriveTypes from "./google-drive/types";
import * as googleDriveUnescape from "./google-drive/unescape";
import * as mcpConfigurator from "./mcp/configurator";
import * as mcpConnectorTools from "./mcp/connector-tools";
import * as mcpMcpClient from "./mcp/mcp-client";
import * as mcpTypes from "./mcp/types";
import * as saveOutputsMain from "./save-outputs/main";
import * as toolsSearchEvents from "./tools/Search-Events";
import * as toolsSearchHotels from "./tools/Search-Hotels";
import * as toolsSearchJobs from "./tools/Search-Jobs";
import * as toolsSearchMoma from "./tools/Search-Moma";
import * as toolsCodeExecution from "./tools/code-execution";
import * as toolsGetWeatherTool from "./tools/get-weather-tool";
import * as toolsGetWeather from "./tools/get-weather";
import * as toolsGetWebpage from "./tools/get-webpage";
import * as toolsSearchEnterprise from "./tools/search-enterprise";
import * as toolsSearchInternal from "./tools/search-internal";
import * as toolsSearchMaps from "./tools/search-maps";
import * as toolsSearchWeb from "./tools/search-web";
import * as toolsSearchWikipedia from "./tools/search-wikipedia";
import * as toolsSqlQueryInternal from "./tools/sql-query-internal";
import * as toolsToolGetWebpage from "./tools/tool-get-webpage";
import * as toolsToolSearchEnterprise from "./tools/tool-search-enterprise";
import * as toolsToolSearchEvents from "./tools/tool-search-events";
import * as toolsToolSearchHotels from "./tools/tool-search-hotels";
import * as toolsToolSearchInternal from "./tools/tool-search-internal";
import * as toolsToolSearchJobs from "./tools/tool-search-jobs";
import * as toolsToolSearchMaps from "./tools/tool-search-maps";
import * as toolsToolSearchMoma from "./tools/tool-search-moma";
import * as toolsToolSearchWeb from "./tools/tool-search-web";
import * as toolsToolSearchWikipedia from "./tools/tool-search-wikipedia";
import * as toolsToolSqlQueryInternal from "./tools/tool-sql-query-internal";
import * as videoGeneratorMain from "./video-generator/main";
import * as musicGeneratorMain from "./music-generator/main";
import * as deepResearchMain from "./deep-research/main";

export const a2 = {
  a2: {
    "audio-generator": a2AudioGenerator,
    "combine-outputs": a2CombineOutputs,
    common: a2Common,
    "connector-manager": a2ConnectorManager,
    entry: a2Entry,
    "for-each": a2ForEach,
    "gemini-prompt": a2GeminiPrompt,
    gemini: a2Gemini,
    "html-generator": a2HtmlGenerator,
    "image-editor": a2ImageEditor,
    "image-generator": a2ImageGenerator,
    "image-utils": a2ImageUtils,
    introducer: a2Introducer,
    lists: a2Lists,
    "make-code": a2MakeCode,
    output: a2Output,
    "render-outputs": a2RenderOutputs,
    researcher: a2Researcher,
    rpc: a2Rpc,
    settings: a2Settings,
    "step-executor": a2StepExecutor,
    template: a2Template,
    "text-entry": a2TextEntry,
    "text-main": a2TextMain,
    "tool-manager": a2ToolManager,
    utils: a2Utils,
  },
  "audio-generator": {
    main: audioGeneratorMain,
  },
  "file-system": {
    configurator: fileSystemConfigurator,
    "connector-load": fileSystemConnectorLoad,
    "connector-save": fileSystemConnectorSave,
    types: fileSystemTypes,
  },
  folio: {
    configurator: folioConfigurator,
    "load-all": folioLoadAll,
    "save-state": folioSaveState,
  },
  generate: {
    main: generateMain,
  },
  "generate-text": {
    "chat-tools": generateTextChatTools,
    entry: generateTextEntry,
    join: generateTextJoin,
    main: generateTextMain,
    "system-instruction-ts": generateTextSystemInstructionTs,
    "system-instruction": generateTextSystemInstruction,
    types: generateTextTypes,
  },
  gmail: {
    configurator: gmailConfigurator,
    "get-emails": gmailGetEmails,
  },
  "go-over-list": {
    "conversational-planner-prompt": goOverListConversationalPlannerPrompt,
    "conversational-think-strategist": goOverListConversationalThinkStrategist,
    main: goOverListMain,
    "organizer-prompt": goOverListOrganizerPrompt,
    "parallel-strategist": goOverListParallelStrategist,
    "planner-prompt": goOverListPlannerPrompt,
    runtime: goOverListRuntime,
    "sequential-strategist": goOverListSequentialStrategist,
    "system-instruction": goOverListSystemInstruction,
    "think-strategist": goOverListThinkStrategist,
    types: goOverListTypes,
  },
  "google-drive": {
    api: googleDriveApi,
    configurator: googleDriveConfigurator,
    "connector-load": googleDriveConnectorLoad,
    "connector-save": googleDriveConnectorSave,
    docs: googleDriveDocs,
    "marked-types": googleDriveMarkedTypes,
    marked: googleDriveMarked,
    sheets: googleDriveSheets,
    "slides-schema": googleDriveSlidesSchema,
    slides: googleDriveSlides,
    types: googleDriveTypes,
    unescape: googleDriveUnescape,
  },
  mcp: {
    configurator: mcpConfigurator,
    "connector-tools": mcpConnectorTools,
    "mcp-client": mcpMcpClient,
    types: mcpTypes,
  },
  "save-outputs": {
    main: saveOutputsMain,
  },
  tools: {
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
  },
  "video-generator": {
    main: videoGeneratorMain,
  },
  "music-generator": {
    main: musicGeneratorMain,
  },
  "deep-research": {
    main: deepResearchMain,
  },
};
