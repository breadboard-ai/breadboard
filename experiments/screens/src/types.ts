export type Schema = {
  type: "string" | "number" | "integer" | "boolean" | "object" | "array";
  format?: string;
  description?: string;
  nullable?: boolean;
  enum?: string[];
  maxItems?: string | number;
  minItems?: string | number;
  properties?: Record<string, Schema>;
  anyOf?: Schema[];
  required?: string[];
  items?: Schema;
};

/**
 * Represents data that was validated to conform to a JSON schema that is
 * appropriate for the context.
 */
export type SchemaValidated =
  | string
  | number
  | boolean
  | null
  | Array<SchemaValidated>
  | {
      [K: string]: SchemaValidated;
    };

export type CallToolRequest = {
  name: string;
  arguments: Record<string, SchemaValidated>;
};

export type CallToolResponse = {
  content: LLMContent;
  isError: boolean;
};

export type McpClient = {
  callTool(params: CallToolRequest): Promise<CallToolResponse>;
};

export type Console = {
  /**
   * Call this method to report errors.
   * @param params -- useful information about the error, usually strings
   */
  error(...params: unknown[]): void;
  /**
   * Call this method to log progress.
   * @param params -- useful information to log, usually strings
   */
  log(...params: unknown[]): void;
};

export type Capabilities = {
  generate: Gemini;
  mcp: McpClient;
  console: Console;
  screens: ScreenServer;
  /**
   * The prompt capabilities.
   */
  prompts: {
    /**
     * Gets a prompt by id.
     * @param id The id of the prompt.
     * @param values A property bag for substituting placeholders in the prompt.
     * @returns The prompt with the placeholders substituted.
     */
    get: (
      id: string,
      values?: Record<string, SchemaValidated>
    ) => Promise<Prompt>;
  };
};

export type Invoke = (capabilities: Capabilities) => Promise<LLMContent>;

export type Screen = {
  screenId: string;
  description: string;
  inputSchema: Schema;
  events: EventDescriptor[];
};

export type EventDescriptor = {
  eventId: string;
  description: string;
  /**
   * The schema for the data that is dispatched along with the event. IF not
   * present, there's no additional data supplied for this event.
   */
  outputSchema?: Schema;
};

export type Prompt = {
  id: string;
  description: string;
  format: "text" | "json";
  inputSchema?: Schema;
  schema?: Schema;
  value: string;
};

/**
 * The Screen Server. Manages a set of pre-defined application screens and
 * allows the application to render them and to obtain user inputs from those
 * screens.
 *
 * For best results, call `getUserEvents` prior to `renderScreen` to capture any
 * user events and then act on them to render the right screen. Combined
 * together, `getUserEvents` and `renderScreen` form the rendering loop for the
 * application UI.
 */
export type ScreenServer = {
  /**
   * Gets the list of user events. Will block until it receives at least one
   * user event. Accumulates and drains the queue of user events when called.
   */
  getUserEvents(): Promise<GetUserEventsResponse>;
  /**
   * Updates screens with specified ids. This call does not block on user
   * input. To collect user input from the screen, call `getUserEvents`.
   * To make updates more efficiens, multiple screens can be updated in a
   * single call.
   *
   * @param screenInputs -- the list of the screen inputs to update.
   */
  updateScreens(screenInputs: ScreenInput[]): Promise<RenderScreenResponse>;
};

export type ScreenInput = {
  screenId: string;
  inputs: SchemaValidated;
};

export type GetUserEventsResponse = {
  events: UserEvent[];
  isError: boolean;
};

export type RenderScreenResponse = {
  isError: boolean;
};

export type UserEvent = {
  screenId: string;
  eventId: string;
  output?: SchemaValidated;
};

/**
 * Access to Gemini API
 */
export type Gemini = {
  generateContent(args: GeminiInputs): Promise<GeminiOutputs>;
};

export type HarmBlockThreshold =
  // Content with NEGLIGIBLE will be allowed.
  | "BLOCK_LOW_AND_ABOVE"
  // Content with NEGLIGIBLE and LOW will be allowed.
  | "BLOCK_MEDIUM_AND_ABOVE"
  // Content with NEGLIGIBLE, LOW, and MEDIUM will be allowed.
  | "BLOCK_ONLY_HIGH"
  // All content will be allowed.
  | "BLOCK_NONE"
  // Turn off the safety filter.
  | "OFF";

export type HarmCategory =
  // Gemini - Harassment content
  | "HARM_CATEGORY_HARASSMENT"
  //	Gemini - Hate speech and content.
  | "HARM_CATEGORY_HATE_SPEECH"
  // Gemini - Sexually explicit content.
  | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
  // 	Gemini - Dangerous content.
  | "HARM_CATEGORY_DANGEROUS_CONTENT"
  // Gemini - Content that may be used to harm civic integrity.
  | "HARM_CATEGORY_CIVIC_INTEGRITY";

export type Modality = "TEXT" | "IMAGE" | "AUDIO";

export type GenerationConfig = {
  responseMimeType?: "text/plain" | "application/json" | "text/x.enum";
  responseSchema?: Schema;
  responseModalities?: Modality[];
};

export type SafetySetting = {
  category: HarmCategory;
  threshold: HarmBlockThreshold;
};

export type FunctionCallPart = {
  functionCall: {
    name: string;
    args: object;
  };
};

export type FunctionResponsePart = {
  functionResponse: {
    name: string;
    response: object;
  };
};

export type TextPart = {
  text: string;
};

export type DataStoreHandle = string;

export type FileDataPart = {
  fileData: {
    /**
     * Can be one of these three:
     * - a URL pointing to a YT video
     * - a URL pointing at a resource saved with File API.
     * - a VFS path in the format of "/vfs/out/[guid]"
     */
    fileUri: string;
    mimeType: string;
    resourceKey?: string;
  };
};

export type ExecutableCodePart = {
  executableCode: {
    language: "LANGUAGE_UNSPECIFIED" | "PYTHON";
    code: string;
  };
};

export type CodeExecutionResultOutcome =
  // 	Unspecified status. This value should not be used.
  | "OUTCOME_UNSPECIFIED"
  // Code execution completed successfully.
  | "OUTCOME_OK"
  // Code execution finished but with a failure. stderr should contain the reason.
  | "OUTCOME_FAILED"
  // Code execution ran for too long, and was cancelled. There may or may not be a partial output present.
  | "OUTCOME_DEADLINE_EXCEEDED";

export type CodeExecutionResultPart = {
  codeExecutionResult: {
    outcome: CodeExecutionResultOutcome;
    output: string;
  };
};

export type DataPart =
  | InlineDataPart
  | FileDataPart
  | ExecutableCodePart
  | CodeExecutionResultPart
  | FunctionCallPart
  | FunctionResponsePart
  | TextPart;

export type LLMContent = {
  role?: string;
  parts: DataPart[];
};

/**
 * Represents inline data, encoded as a base64 string. Use only for inputs.
 * Outputs are always provided as FileData with VFS path.
 */
export type InlineDataPart = {
  inlineData: {
    mimeType: string;
    data: string;
    title?: string;
  };
};

export type GeminiInputs = {
  model?: string;
  contents: LLMContent[];
  tools?: Tool[];
  toolConfig?: ToolConfig;
  systemInstruction?: LLMContent;
  safetySettings?: SafetySetting[];
  generationConfig?: GenerationConfig;
};

export type Tool = {
  functionDeclarations?: FunctionDeclaration[];
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  googleSearch?: {};
  codeExecution?: CodeExecution;
};

export type ToolConfig = {
  functionCallingConfig?: FunctionCallingConfig;
};

export type FunctionCallingConfig = {
  mode?: "MODE_UNSPECIFIED" | "AUTO" | "ANY" | "NONE";
  allowedFunctionNames?: string[];
};

export type FunctionDeclaration = {
  name: string;
  description: string;
  parameters?: Schema;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type CodeExecution = {
  // Type contains no fields.
};

export type FinishReason =
  // Natural stop point of the model or provided stop sequence.
  | "STOP"
  // The maximum number of tokens as specified in the request was reached.
  | "MAX_TOKENS"
  // The response candidate content was flagged for safety reasons.
  | "SAFETY"
  // The response candidate content was flagged for image safety reasons.
  | "IMAGE_SAFETY"
  // The response candidate content was flagged for recitation reasons.
  | "RECITATION"
  // The response candidate content was flagged for using an unsupported language.
  | "LANGUAGE"
  // Unknown reason.
  | "OTHER"
  // Token generation stopped because the content contains forbidden terms.
  | "BLOCKLIST"
  // Token generation stopped for potentially containing prohibited content.
  | "PROHIBITED_CONTENT"
  // Token generation stopped because the content potentially contains Sensitive Personally Identifiable Information (SPII).
  | "SPII"
  // The function call generated by the model is invalid.
  | "MALFORMED_FUNCTION_CALL";

export type GroundingMetadata = {
  groundingChunks: {
    web: {
      uri: string;
      title: string;
    };
  }[];
  groundingSupports: {
    groundingChunkIndices: number[];
    confidenceScores: number[];
    segment: {
      partIndex: number;
      startIndex: number;
      endIndex: number;
      text: string;
    };
  };
  webSearchQueries: string[];
  searchEntryPoint: {
    renderedContent: string;
    /**
     * Base64 encoded JSON representing array of <search term, search url> tuple.
     * A base64-encoded string.
     */
    sdkBlob: string;
  };
  retrievalMetadata: {
    googleSearchDynamicRetrievalScore: number;
  };
};

export type Candidate = {
  /**
   * The LLM output.
   * IMPORTANT: Unlike the standard Gemini API, any media will be provided as
   * the `FileDataPart` with the `fileUri` populated with the VFS file path.
   * The VFS is the virtual file system that allows efficiently passing large
   * media files within the application. The VFS paths are opaque identifiers
   * for media files and can be provided as both inputs and outputs. The VFS
   * files always start with "/vfs/".
   */
  content?: LLMContent;
  finishReason?: FinishReason;
  safetyRatings?: SafetySetting[];
  tokenOutput?: number;
  groundingMetadata?: GroundingMetadata;
};

export type GeminiOutputs = {
  candidates: Candidate[];
};
