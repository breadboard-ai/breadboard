/**
 * @fileoverview Common type definitions
 */

import { LLMContent } from "@breadboard-ai/types";
import type { Params } from "../a2/common.js";

export type GenerateTextInputs = {
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
};
