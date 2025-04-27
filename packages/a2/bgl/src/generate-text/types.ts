/**
 * @fileoverview Common type definitions
 */

import type { Params } from "./a2/common";

export type GenerateTextInputs = {
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
   *
   */
  systemInstruction?: LLMContent;
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
   * params
   */
  params: Params;
};

export type SharedContext = GenerateTextInputs & {
  /**
   * A unique identifier for the session.
   * Currently used to have a persistent part separator across conversation context
   */
  id: string;
  /**
   * Accumulating list of user inputs
   */
  userInputs: LLMContent[];
  /**
   * Indicator that the user ended chat.
   */
  userEndedChat: boolean;
};
