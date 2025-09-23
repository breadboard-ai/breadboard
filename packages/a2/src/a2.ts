import * as folioConfigurator from "../bgl/src/folio/configurator";
import * as folioLoadAll from "../bgl/src/folio/load-all";
import * as folioSaveState from "../bgl/src/folio/save-state";
import * as a2AudioGenerator from "../bgl/src/a2/audio-generator";
import * as a2CombineOutputs from "../bgl/src/a2/combine-outputs";
import * as a2Common from "../bgl/src/a2/common";
import * as a2ConnectorManager from "../bgl/src/a2/connector-manager";
import * as a2Entry from "../bgl/src/a2/entry";
import * as a2ForEach from "../bgl/src/a2/for-each";
import * as a2GeminiPrompt from "../bgl/src/a2/gemini-prompt";
import * as a2Gemini from "../bgl/src/a2/gemini";
import * as a2HtmlGenerator from "../bgl/src/a2/html-generator";
import * as a2ImageEditor from "../bgl/src/a2/image-editor";
import * as a2ImageGenerator from "../bgl/src/a2/image-generator";
import * as a2ImageUtils from "../bgl/src/a2/image-utils";
import * as a2Introducer from "../bgl/src/a2/introducer";
import * as a2Lists from "../bgl/src/a2/lists";
import * as a2MakeCode from "../bgl/src/a2/make-code";
import * as a2Output from "../bgl/src/a2/output";
import * as a2RenderOutputs from "../bgl/src/a2/render-outputs";
import * as a2Researcher from "../bgl/src/a2/researcher";
import * as a2Rpc from "../bgl/src/a2/rpc";
import * as a2Settings from "../bgl/src/a2/settings";
import * as a2StepExecutor from "../bgl/src/a2/step-executor";
import * as a2Template from "../bgl/src/a2/template";
import * as a2TextEntry from "../bgl/src/a2/text-entry";
import * as a2TextMain from "../bgl/src/a2/text-main";
import * as a2ToolManager from "../bgl/src/a2/tool-manager";
import * as a2Utils from "../bgl/src/a2/utils";
import * as audioGeneratorMain from "../bgl/src/audio-generator/main";
import * as fileSystemConfigurator from "../bgl/src/file-system/configurator";
import * as fileSystemConnectorLoad from "../bgl/src/file-system/connector-load";
import * as fileSystemConnectorSave from "../bgl/src/file-system/connector-save";
import * as fileSystemTypes from "../bgl/src/file-system/types";
import * as generateMain from "../bgl/src/generate/main";
import * as gmailConfigurator from "../bgl/src/gmail/configurator";
import * as gmailGetEmails from "../bgl/src/gmail/get-emails";
import * as generateTextChatTools from "../bgl/src/generate-text/chat-tools";
import * as generateTextEntry from "../bgl/src/generate-text/entry";
import * as generateTextJoin from "../bgl/src/generate-text/join";
import * as generateTextMain from "../bgl/src/generate-text/main";
import * as generateTextSystemInstructionTs from "../bgl/src/generate-text/system-instruction-ts";
import * as generateTextSystemInstruction from "../bgl/src/generate-text/system-instruction";
import * as generateTextTypes from "../bgl/src/generate-text/types";
import * as goOverListConversationalPlannerPrompt from "../bgl/src/go-over-list/conversational-planner-prompt";
import * as goOverListConversationalThinkStrategist from "../bgl/src/go-over-list/conversational-think-strategist";
import * as goOverListMain from "../bgl/src/go-over-list/main";
import * as goOverListOrganizerPrompt from "../bgl/src/go-over-list/organizer-prompt";
import * as goOverListParallelStrategist from "../bgl/src/go-over-list/parallel-strategist";
import * as goOverListPlannerPrompt from "../bgl/src/go-over-list/planner-prompt";
import * as goOverListRuntime from "../bgl/src/go-over-list/runtime";
import * as goOverListSequentialStrategist from "../bgl/src/go-over-list/sequential-strategist";
import * as goOverListSystemInstruction from "../bgl/src/go-over-list/system-instruction";
import * as goOverListThinkStrategist from "../bgl/src/go-over-list/think-strategist";
import * as goOverListTypes from "../bgl/src/go-over-list/types";
import * as googleDriveApi from "../bgl/src/google-drive/api";
import * as googleDriveConfigurator from "../bgl/src/google-drive/configurator";
import * as googleDriveConnectorLoad from "../bgl/src/google-drive/connector-load";
import * as googleDriveConnectorSave from "../bgl/src/google-drive/connector-save";
import * as googleDriveDocs from "../bgl/src/google-drive/docs";
import * as googleDriveMarkedTypes from "../bgl/src/google-drive/marked-types";
import * as googleDriveMarked from "../bgl/src/google-drive/marked";
import * as googleDriveSheets from "../bgl/src/google-drive/sheets";
import * as googleDriveSlidesSchema from "../bgl/src/google-drive/slides-schema";
import * as googleDriveSlides from "../bgl/src/google-drive/slides";
import * as googleDriveTypes from "../bgl/src/google-drive/types";
import * as googleDriveUnescape from "../bgl/src/google-drive/unescape";
import * as mcpConfigurator from "../bgl/src/mcp/configurator";
import * as mcpConnectorTools from "../bgl/src/mcp/connector-tools";
import * as mcpMcpClient from "../bgl/src/mcp/mcp-client";
import * as mcpTypes from "../bgl/src/mcp/types";
import * as saveOutputsMain from "../bgl/src/save-outputs/main";
import * as toolsSearchEvents from "../bgl/src/tools/Search-Events";
import * as toolsSearchHotels from "../bgl/src/tools/Search-Hotels";
import * as toolsSearchJobs from "../bgl/src/tools/Search-Jobs";
import * as toolsSearchMoma from "../bgl/src/tools/Search-Moma";
import * as toolsCodeExecution from "../bgl/src/tools/code-execution";
import * as toolsGetWeatherTool from "../bgl/src/tools/get-weather-tool";
import * as toolsGetWeather from "../bgl/src/tools/get-weather";
import * as toolsGetWebpage from "../bgl/src/tools/get-webpage";
import * as toolsSearchEnterprise from "../bgl/src/tools/search-enterprise";
import * as toolsSearchInternal from "../bgl/src/tools/search-internal";
import * as toolsSearchMaps from "../bgl/src/tools/search-maps";
import * as toolsSearchWeb from "../bgl/src/tools/search-web";
import * as toolsSearchWikipedia from "../bgl/src/tools/search-wikipedia";
import * as toolsSqlQueryInternal from "../bgl/src/tools/sql-query-internal";
import * as toolsToolGetWebpage from "../bgl/src/tools/tool-get-webpage";
import * as toolsToolSearchEnterprise from "../bgl/src/tools/tool-search-enterprise";
import * as toolsToolSearchEvents from "../bgl/src/tools/tool-search-events";
import * as toolsToolSearchHotels from "../bgl/src/tools/tool-search-hotels";
import * as toolsToolSearchInternal from "../bgl/src/tools/tool-search-internal";
import * as toolsToolSearchJobs from "../bgl/src/tools/tool-search-jobs";
import * as toolsToolSearchMaps from "../bgl/src/tools/tool-search-maps";
import * as toolsToolSearchMoma from "../bgl/src/tools/tool-search-moma";
import * as toolsToolSearchWeb from "../bgl/src/tools/tool-search-web";
import * as toolsToolSearchWikipedia from "../bgl/src/tools/tool-search-wikipedia";
import * as toolsToolSqlQueryInternal from "../bgl/src/tools/tool-sql-query-internal";
import * as videoGeneratorMain from "../bgl/src/video-generator/main";
import * as musicGeneratorMain from "../bgl/src/music-generator/main";
import * as deepResearchMain from "../bgl/src/deep-research/main";
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
