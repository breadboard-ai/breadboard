/**
 * @fileoverview Common types and code
 */

export type UserInput = LLMContent;

export type Params = {
  [key: `p-z-${string}`]: unknown;
};

export type GraphTag =
  | "connector"
  | "connector-configure"
  | "connector-load"
  | "connector-save";

export type ExportDescriberResult = {
  title?: string;
  description?: string;
  metadata?: {
    icon?: string;
    tags?: GraphTag[];
  };
  inputSchema?: Schema;
};

export type DescriberResult = {
  title?: string;
  metadata?: {
    tags?: GraphTag[];
  };
  description?: string;
  inputSchema?: Schema;
  outputSchema?: Schema;
  exports?: Record<string, ExportDescriberResult>;
};

export type DescriberResultTransformer = {
  /**
   * Returns a transformed result, a `null` if no transformation happened,
   * or an error as Outcome.
   */
  transform(result: DescriberResult): Promise<Outcome<DescriberResult | null>>;
};

export type CallToolCallback = (
  tool: string,
  args: object,
  passContext?: boolean
) => Promise<void>;

export type AgentInputs = {
  /**
   * Whether (true) or not (false) the agent is allowed to chat with user.
   */
  chat: boolean;
  /**
   * Whether (true) or not (false) to try to turn the output into a list
   */
  makeList: boolean;
  /**
   * The incoming conversation context.
   */
  context: LLMContent[];
  /**
   * Accumulated work context. This is the internal conversation, a result
   * of talking with the user, for instance.
   * This context is discarded at the end of interacting with the agent.
   */
  work: LLMContent[];
  /**
   * The index path to the currently processed list.
   */
  listPath: number[];
  /**
   * Agent's job description.
   */
  description?: LLMContent;
  /**
   * Last work product.
   */
  last?: LLMContent;
  /**
   * Type of the task.
   */
  type: "introduction" | "work";
  /**
   * The board URL of the model
   */
  model: string;
  /**
   * The default model that is passed along by the manager
   */
  defaultModel: string;
  /**
   * The tools that the worker can use
   */
  tools?: string[];
  /**
   * params
   */
  params: Params;
};

export type AgentContext = AgentInputs & {
  /**
   * A unique identifier for the session.
   * Currently used to have a persistent part separator across conversation context
   */
  id: string;
  /**
   * Accumulating list of user inputs
   */
  userInputs: UserInput[];
  /**
   * Indicator that the user ended chat.
   */
  userEndedChat: boolean;
};

export type DescribeInputs = {
  inputs: {
    description: LLMContent | undefined;
  };
};
